using System;
using System.Collections.Concurrent;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;

namespace Webority.Cli
{
    // Multi-session-safe local bridge to the Figma desktop plugin. Every Claude session on the
    // machine runs its own MCP server; they coordinate over one port so all of them can share the
    // single plugin connection:
    //   - The first server to bind the port becomes the LEADER: it owns the one WebSocket the
    //     Figma plugin connects to and serves HTTP /rpc (relay) + /ping (status) for the others.
    //   - Later servers are FOLLOWERS: their calls proxy to the leader over /rpc. If the leader
    //     process dies, the next follower call fails to reach it, re-runs the election (re-binds
    //     the port, promoting itself), and the plugin auto-reconnects within ~2s.
    // Nothing binds until the first figma_* call, so sessions that never touch Figma never own
    // the port. Figma's Chromium resolves localhost to ::1 while the follower relay uses
    // 127.0.0.1, so the leader listens on BOTH loopbacks (never non-loopback interfaces).
    public sealed class FigmaBridge : IDisposable
    {
        internal const int DefaultPort = 3691;
        internal static string PluginNotConnectedMessage =>
            "No Figma plugin connected. " + FigmaPluginInstaller.ImportHint;

        // Process-lifetime singleton holding one HttpClient for the loopback relay — the sanctioned
        // exception to the IHttpClientFactory rule (no DNS churn, one fixed local endpoint).
        private static readonly HttpClient LeaderHttp = new HttpClient();

        private readonly int _port;
        private readonly SemaphoreSlim _electionLock = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _sendLock = new SemaphoreSlim(1, 1);
        private readonly ConcurrentDictionary<string, TaskCompletionSource<JsonNode>> _pending = new(StringComparer.Ordinal);
        private TcpListener _v4Listener;
        private TcpListener _v6Listener;
        private WebSocket _pluginSocket;
        private string _pluginVersion;
        private bool _elected;
        private bool _isLeader;
        private long _seq;

        public FigmaBridge() : this(DefaultPort) { }

        internal FigmaBridge(int port) => _port = port;

        public async Task<JsonNode> InvokeAsync(string command, JsonObject parameters, int timeoutMs, CancellationToken cancellationToken)
        {
            await EnsureElectedAsync(cancellationToken);
            if (_isLeader)
            {
                return await RequestViaPluginAsync(command, parameters, timeoutMs, cancellationToken);
            }
            return await RequestViaLeaderAsync(command, parameters, timeoutMs, cancellationToken);
        }

        public async Task<(bool IsLeader, bool PluginConnected)> StatusAsync(CancellationToken cancellationToken)
        {
            var (isLeader, connected, _) = await StatusWithVersionAsync(cancellationToken);
            return (isLeader, connected);
        }

        // PluginVersion is the build the connected plugin announced on connect, or null when it
        // announced nothing: a plugin from before the handshake existed, i.e. a stale copy.
        public async Task<(bool IsLeader, bool PluginConnected, string PluginVersion)> StatusWithVersionAsync(CancellationToken cancellationToken)
        {
            await EnsureElectedAsync(cancellationToken);
            if (_isLeader)
            {
                return (true, PluginConnected, PluginConnected ? _pluginVersion : null);
            }
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(4000);
                var json = await LeaderHttp.GetStringAsync(new Uri($"http://127.0.0.1:{_port.ToString(CultureInfo.InvariantCulture)}/ping"), cts.Token);
                var node = JsonNode.Parse(json);
                var connected = node?["plugin"]?.GetValue<bool>() ?? false;
                return (false, connected, connected ? node?["version"]?.GetValue<string>() : null);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                // The leader is gone — take over the port so the next call (and the plugin's
                // auto-reconnect) lands here.
                await ReElectAsync(cancellationToken);
                return (_isLeader, _isLeader && PluginConnected, _isLeader && PluginConnected ? _pluginVersion : null);
            }
        }

        private bool PluginConnected => _pluginSocket is { State: WebSocketState.Open };

        private async Task EnsureElectedAsync(CancellationToken cancellationToken)
        {
            if (_elected)
            {
                return;
            }
            await _electionLock.WaitAsync(cancellationToken);
            try
            {
                if (!_elected)
                {
                    Elect();
                    _elected = true;
                }
            }
            finally
            {
                _electionLock.Release();
            }
        }

        private async Task ReElectAsync(CancellationToken cancellationToken)
        {
            await _electionLock.WaitAsync(cancellationToken);
            try
            {
                if (!_isLeader)
                {
                    Elect();
                }
            }
            finally
            {
                _electionLock.Release();
            }
        }

        private void Elect()
        {
            var v4 = new TcpListener(IPAddress.Loopback, _port);
            var v6 = new TcpListener(IPAddress.IPv6Loopback, _port);
            try
            {
                // Rival bridges always collide here (they all bind v4 first) — a v4 failure
                // means another session owns the bridge.
                v4.Start();
            }
            catch (SocketException)
            {
                v4.Dispose();
                v6.Dispose();
                _isLeader = false;
                Console.Error.WriteLine("[figma-bridge] follower — another session owns the bridge");
                return;
            }
            try
            {
                v6.Start();
            }
            catch (SocketException)
            {
                // v4 bound but v6 didn't: some unrelated process holds the IPv6 loopback port, so
                // NO session can lead until it releases it. Name the real cause — this is not the
                // ordinary lost-the-race case.
                v4.Dispose();
                v6.Dispose();
                _isLeader = false;
                Console.Error.WriteLine($"[figma-bridge] follower — port {_port.ToString(CultureInfo.InvariantCulture)} IPv6 loopback is held by an unrelated process; no session can lead until it is released");
                return;
            }
            _v4Listener = v4;
            _v6Listener = v6;
            _isLeader = true;
            _ = AcceptLoopAsync(_v4Listener);
            _ = AcceptLoopAsync(_v6Listener);
            Console.Error.WriteLine("[figma-bridge] leader — owns the Figma plugin bridge");
        }

        public void Dispose()
        {
            _v4Listener?.Dispose();
            _v6Listener?.Dispose();
            _pluginSocket?.Dispose();
            _electionLock.Dispose();
            _sendLock.Dispose();
        }

        private async Task AcceptLoopAsync(TcpListener listener)
        {
            while (true)
            {
                TcpClient client;
                try
                {
                    client = await listener.AcceptTcpClientAsync();
                }
                catch (Exception)
                {
                    return; // listener disposed / process shutting down
                }
                _ = HandleConnectionAsync(client);
            }
        }

        private async Task HandleConnectionAsync(TcpClient client)
        {
            try
            {
                using (client)
                {
                    var stream = client.GetStream();
                    var request = await HttpHead.ReadAsync(stream);
                    if (request == null)
                    {
                        return;
                    }

                    if (request.IsWebSocketUpgrade)
                    {
                        await ServePluginSocketAsync(stream, request);
                        return;
                    }
                    if (request.Method == "GET" && request.Path == "/ping")
                    {
                        var ping = new JsonObject
                        {
                            ["role"] = "leader",
                            ["plugin"] = PluginConnected,
                            ["version"] = PluginConnected ? _pluginVersion : null
                        };
                        var body = ping.ToJsonString();
                        await HttpHead.WriteResponseAsync(stream, 200, body);
                        return;
                    }
                    if (request.Method == "POST" && request.Path == "/rpc")
                    {
                        await ServeRpcAsync(stream, request);
                        return;
                    }
                    await HttpHead.WriteResponseAsync(stream, 404, "{}");
                }
            }
            catch (Exception)
            {
                // A broken local connection is not actionable — the caller retries.
            }
        }

        private async Task ServePluginSocketAsync(NetworkStream stream, HttpHead request)
        {
            var key = request.Header("Sec-WebSocket-Key");
            if (string.IsNullOrEmpty(key))
            {
                await HttpHead.WriteResponseAsync(stream, 400, "{}");
                return;
            }
#pragma warning disable CA5350 // RFC 6455 mandates SHA-1 for the WebSocket accept key — no alternative exists
            var accept = Convert.ToBase64String(SHA1.HashData(Encoding.ASCII.GetBytes(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")));
#pragma warning restore CA5350
            var handshake =
                "HTTP/1.1 101 Switching Protocols\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                $"Sec-WebSocket-Accept: {accept}\r\n\r\n";
            await stream.WriteAsync(Encoding.ASCII.GetBytes(handshake));

            using var socket = WebSocket.CreateFromStream(stream, isServer: true, subProtocol: null, keepAliveInterval: TimeSpan.FromSeconds(30));
            _pluginSocket = socket; // latest plugin connection wins, matching the plugin's reconnect loop
            _pluginVersion = null;  // known only once this connection announces itself
            await Console.Error.WriteLineAsync("[figma-bridge] Figma plugin connected");
            try
            {
                await ReceiveLoopAsync(socket);
            }
            finally
            {
                if (ReferenceEquals(_pluginSocket, socket))
                {
                    _pluginSocket = null;
                }
            }
        }

        private async Task ReceiveLoopAsync(WebSocket socket)
        {
            var buffer = new byte[64 * 1024];
            using var message = new MemoryStream();
            while (socket.State == WebSocketState.Open)
            {
                WebSocketReceiveResult result;
                try
                {
                    result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                }
                catch (Exception)
                {
                    return;
                }
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    // Complete the close handshake before the connection is torn down.
                    try
                    {
                        await socket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, "bye", CancellationToken.None);
                    }
                    catch (Exception)
                    {
                        // Peer may already be gone — nothing to hand back.
                    }
                    return;
                }
                await message.WriteAsync(buffer.AsMemory(0, result.Count));
                if (!result.EndOfMessage)
                {
                    continue;
                }
                OnPluginMessage(Encoding.UTF8.GetString(message.GetBuffer(), 0, (int)message.Length));
                message.SetLength(0);
            }
        }

        private void OnPluginMessage(string raw)
        {
            JsonNode msg;
            try
            {
                msg = JsonNode.Parse(raw);
            }
            catch (Exception)
            {
                return;
            }
            // A malformed message (non-string id/error) must degrade to "ignore" — an uncaught
            // throw here would unwind the receive loop and tear down the whole plugin connection.
            string id;
            try
            {
                if (msg?["hello"]?.GetValue<bool>() == true)
                {
                    _pluginVersion = msg["version"]?.GetValue<string>();
                    return;
                }
                id = msg?["id"]?.GetValue<string>();
            }
            catch (Exception)
            {
                return;
            }
            if (id == null || !_pending.TryRemove(id, out var pending))
            {
                return;
            }
            var error = msg["error"];
            if (error != null)
            {
                string message;
                try
                {
                    message = error.GetValue<string>();
                }
                catch (Exception)
                {
                    message = error.ToJsonString();
                }
                if (message.StartsWith("Unknown command", StringComparison.Ordinal))
                {
                    // Only a plugin build older than this CLI answers that; name the fix.
                    message += ". " + FigmaPluginInstaller.StalePluginHint;
                }
                pending.TrySetException(new InvalidOperationException(message));
            }
            else
            {
                // Detach from the arrival envelope — JsonNode is single-parent, and callers
                // re-attach the result to their own response objects.
                pending.TrySetResult(msg["result"]?.DeepClone());
            }
        }

        private async Task ServeRpcAsync(NetworkStream stream, HttpHead request)
        {
            var body = await request.ReadBodyAsync(stream);
            if (body == null)
            {
                await HttpHead.WriteResponseAsync(stream, 400, "{\"error\":\"body too large\"}");
                return;
            }
            JsonNode payload;
            try
            {
                payload = JsonNode.Parse(body);
            }
            catch (Exception)
            {
                await HttpHead.WriteResponseAsync(stream, 400, "{\"error\":\"bad request\"}");
                return;
            }
            var response = new JsonObject();
            try
            {
                // CancellationToken.None is deliberate: a follower abandoning its HTTP request must
                // not cancel the leader's in-flight plugin exchange — the plugin serves one command
                // at a time and a cancelled exchange would orphan its reply correlation.
                var result = await RequestViaPluginAsync(
                    payload?["command"]?.GetValue<string>() ?? "",
                    payload?["params"] as JsonObject,
                    payload?["timeoutMs"]?.GetValue<int>() ?? 30000,
                    CancellationToken.None);
                response["result"] = result;
            }
            catch (Exception ex)
            {
                response["error"] = ex.Message;
            }
            await HttpHead.WriteResponseAsync(stream, 200, response.ToJsonString());
        }

        private async Task<JsonNode> RequestViaPluginAsync(string command, JsonObject parameters, int timeoutMs, CancellationToken cancellationToken)
        {
            var socket = _pluginSocket;
            if (socket is not { State: WebSocketState.Open })
            {
                throw new InvalidOperationException(PluginNotConnectedMessage);
            }
            var id = Interlocked.Increment(ref _seq).ToString(CultureInfo.InvariantCulture);
            var tcs = new TaskCompletionSource<JsonNode>(TaskCreationOptions.RunContinuationsAsynchronously);
            _pending[id] = tcs;
            try
            {
                var envelope = new JsonObject
                {
                    ["id"] = id,
                    ["command"] = command,
                    // Clone: on the relay path the params node is still parented to the /rpc payload.
                    ["params"] = parameters?.DeepClone() ?? new JsonObject()
                };
                var bytes = Encoding.UTF8.GetBytes(envelope.ToJsonString());
                await _sendLock.WaitAsync(cancellationToken);
                try
                {
                    // Bound the send itself: a plugin that stops draining the socket while the TCP
                    // connection stays open would otherwise wedge _sendLock for every session on
                    // the machine. On a stalled send, drop the socket so the next call re-detects
                    // "not connected" instead of queuing on a dead connection.
                    using var sendCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                    sendCts.CancelAfter(5000);
                    try
                    {
                        await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, endOfMessage: true, sendCts.Token);
                    }
                    catch (Exception) when (sendCts.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
                    {
                        socket.Abort();
                        if (ReferenceEquals(_pluginSocket, socket))
                        {
                            _pluginSocket = null;
                        }
                        throw new InvalidOperationException("The Figma plugin stopped responding and its connection was dropped. " + PluginNotConnectedMessage);
                    }
                }
                finally
                {
                    _sendLock.Release();
                }
                var timeout = Task.Delay(timeoutMs, cancellationToken);
                var finished = await Task.WhenAny(tcs.Task, timeout);
                if (finished == timeout)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    throw new TimeoutException($"Timed out after {timeoutMs.ToString(CultureInfo.InvariantCulture)}ms waiting for the Figma plugin to answer '{command}'. Check figma_status.");
                }
                return await tcs.Task;
            }
            finally
            {
                _pending.TryRemove(id, out _);
            }
        }

        private async Task<JsonNode> RequestViaLeaderAsync(string command, JsonObject parameters, int timeoutMs, CancellationToken cancellationToken)
        {
            var payload = new JsonObject
            {
                ["command"] = command,
                ["params"] = parameters ?? new JsonObject(),
                ["timeoutMs"] = timeoutMs
            };
            string json;
            try
            {
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(timeoutMs + 5000);
                using var content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");
                using var response = await LeaderHttp.PostAsync(new Uri($"http://127.0.0.1:{_port.ToString(CultureInfo.InvariantCulture)}/rpc"), content, cts.Token);
                json = await response.Content.ReadAsStringAsync(cts.Token);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                // Leader unreachable — it likely died. Take over the port, then run the call once.
                await ReElectAsync(cancellationToken);
                if (_isLeader)
                {
                    if (!PluginConnected)
                    {
                        // Freshly promoted: the plugin's reconnect loop finds the new leader within
                        // ~2s. Without this distinct message the error reads as "plugin not imported".
                        throw new InvalidOperationException(
                            "The Figma bridge leader changed — this session just took over, and the plugin reconnects within ~2 seconds. Retry the call.");
                    }
                    return await RequestViaPluginAsync(command, parameters, timeoutMs, cancellationToken);
                }
                throw new InvalidOperationException("Figma bridge leader is unreachable. Retry the call.");
            }
            var node = JsonNode.Parse(json);
            var error = node?["error"]?.GetValue<string>();
            if (error != null)
            {
                throw new InvalidOperationException(error);
            }
            return node?["result"]?.DeepClone();
        }

        // Minimal HTTP/1.1 head parser for the bridge's three fixed local endpoints (the plugin
        // upgrade, /ping, /rpc). One request per connection, Connection: close on responses —
        // deliberately not a general HTTP server.
        private sealed class HttpHead
        {
            private readonly System.Collections.Generic.Dictionary<string, string> _headers;

            private HttpHead(string method, string path, System.Collections.Generic.Dictionary<string, string> headers, byte[] bodyPrefix)
            {
                Method = method;
                Path = path;
                _headers = headers;
                BodyPrefix = bodyPrefix;
            }

            public string Method { get; }
            public string Path { get; }
            public byte[] BodyPrefix { get; }

            public string Header(string name) => _headers.TryGetValue(name, out var value) ? value : null;

            public bool IsWebSocketUpgrade =>
                Header("Upgrade") is { } upgrade && upgrade.Contains("websocket", StringComparison.OrdinalIgnoreCase);

            public static async Task<HttpHead> ReadAsync(NetworkStream stream)
            {
                var buffer = new byte[16 * 1024];
                var length = 0;
                while (true)
                {
                    var read = await stream.ReadAsync(buffer.AsMemory(length, buffer.Length - length));
                    if (read == 0)
                    {
                        return null;
                    }
                    length += read;
                    var end = IndexOfHeaderEnd(buffer, length);
                    if (end >= 0)
                    {
                        return Parse(buffer, end, length);
                    }
                    if (length == buffer.Length)
                    {
                        return null; // oversized head — not one of our three callers
                    }
                }
            }

            private static int IndexOfHeaderEnd(byte[] buffer, int length)
            {
                for (var i = 3; i < length; i++)
                {
                    if (buffer[i] == '\n' && buffer[i - 1] == '\r' && buffer[i - 2] == '\n' && buffer[i - 3] == '\r')
                    {
                        return i + 1;
                    }
                }
                return -1;
            }

            private static HttpHead Parse(byte[] buffer, int headEnd, int totalRead)
            {
                var head = Encoding.ASCII.GetString(buffer, 0, headEnd);
                var lines = head.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
                if (lines.Length == 0)
                {
                    return null;
                }
                var requestLine = lines[0].Split(' ');
                if (requestLine.Length < 2)
                {
                    return null;
                }
                var headers = new System.Collections.Generic.Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                for (var i = 1; i < lines.Length; i++)
                {
                    var colon = lines[i].IndexOf(':', StringComparison.Ordinal);
                    if (colon > 0)
                    {
                        headers[lines[i][..colon].Trim()] = lines[i][(colon + 1)..].Trim();
                    }
                }
                var bodyPrefix = new byte[totalRead - headEnd];
                Array.Copy(buffer, headEnd, bodyPrefix, 0, bodyPrefix.Length);
                return new HttpHead(requestLine[0], requestLine[1], headers, bodyPrefix);
            }

            // Loopback-only, but still bounded: /rpc bodies carry base64 exports, and an unbounded
            // Content-Length would let a misbehaving local process balloon this host's memory.
            private const int MaxBodyBytes = 32 * 1024 * 1024;

            public async Task<string> ReadBodyAsync(NetworkStream stream)
            {
                var declared = Header("Content-Length");
                if (declared == null || !int.TryParse(declared, NumberStyles.Integer, CultureInfo.InvariantCulture, out var contentLength))
                {
                    return Encoding.UTF8.GetString(BodyPrefix);
                }
                if (contentLength > MaxBodyBytes)
                {
                    return null;
                }
                var body = new byte[contentLength];
                Array.Copy(BodyPrefix, body, Math.Min(BodyPrefix.Length, contentLength));
                var have = BodyPrefix.Length;
                while (have < contentLength)
                {
                    var read = await stream.ReadAsync(body.AsMemory(have, contentLength - have));
                    if (read == 0)
                    {
                        break;
                    }
                    have += read;
                }
                return Encoding.UTF8.GetString(body, 0, have);
            }

            public static async Task WriteResponseAsync(NetworkStream stream, int status, string jsonBody)
            {
                var body = Encoding.UTF8.GetBytes(jsonBody);
                var reason = status == 200 ? "OK" : status == 400 ? "Bad Request" : "Not Found";
                var head =
                    $"HTTP/1.1 {status.ToString(CultureInfo.InvariantCulture)} {reason}\r\n" +
                    "Content-Type: application/json\r\n" +
                    $"Content-Length: {body.Length.ToString(CultureInfo.InvariantCulture)}\r\n" +
                    "Connection: close\r\n\r\n";
                await stream.WriteAsync(Encoding.ASCII.GetBytes(head));
                await stream.WriteAsync(body);
            }
        }
    }
}
