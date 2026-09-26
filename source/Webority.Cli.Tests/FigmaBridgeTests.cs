using System;
using System.Net;
using System.Net.Sockets;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Webority.Cli;
using Xunit;

namespace Webority.Cli.Tests
{
    // End-to-end exercise of the bridge with a FAKE plugin: a real ClientWebSocket performing the
    // real RFC 6455 handshake against the bridge's hand-rolled HTTP upgrade, then answering the
    // correlated command envelopes exactly like plugin/src/ui.html + code.ts do. Also covers the
    // follower path: a second bridge on the same port must relay through the leader's /rpc.
    public class FigmaBridgeTests : IDisposable
    {
        private readonly int _port = FreePort();
        private readonly FigmaBridge _leader;
        private readonly FigmaBridge _follower;

        public FigmaBridgeTests()
        {
            _leader = new FigmaBridge(_port);
            _follower = new FigmaBridge(_port);
        }

        public void Dispose()
        {
            _follower.Dispose();
            _leader.Dispose();
        }

        [Fact]
        public async Task LeaderAndFollower_RoundTripThroughTheFakePlugin()
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));

            var (isLeader, connected) = await _leader.StatusAsync(cts.Token);
            Assert.True(isLeader);
            Assert.False(connected);

            using var plugin = new ClientWebSocket();
            await plugin.ConnectAsync(new Uri($"ws://127.0.0.1:{_port}/"), cts.Token);
            var pluginLoop = FakePluginLoopAsync(plugin, cts.Token);

            var direct = await _leader.InvokeAsync("get_metadata", null, 10000, cts.Token);
            Assert.Equal("get_metadata", direct["echo"].GetValue<string>());

            var (followerIsLeader, followerSees) = await _follower.StatusAsync(cts.Token);
            Assert.False(followerIsLeader);
            Assert.True(followerSees);

            var relayed = await _follower.InvokeAsync("get_node", new JsonObject { ["nodeId"] = "425:95" }, 10000, cts.Token);
            Assert.Equal("get_node", relayed["echo"].GetValue<string>());
            Assert.Equal("425:95", relayed["nodeId"].GetValue<string>());

            var failure = await Assert.ThrowsAsync<InvalidOperationException>(
                () => _follower.InvokeAsync("boom", null, 10000, cts.Token));
            Assert.Contains("simulated plugin failure", failure.Message, StringComparison.Ordinal);

            await plugin.CloseAsync(WebSocketCloseStatus.NormalClosure, "done", cts.Token);
            await pluginLoop;
        }

        [Fact]
        public async Task FollowerPromotesItself_WhenTheLeaderDies()
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            var (isLeader, _) = await _leader.StatusAsync(cts.Token);
            Assert.True(isLeader);
            var (followerIsLeader, _) = await _follower.StatusAsync(cts.Token);
            Assert.False(followerIsLeader);

            _leader.Dispose();

            // The next follower call must promote this bridge and surface the distinct
            // "leadership moved, retry" message — not the plugin-not-imported guidance.
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(
                () => _follower.InvokeAsync("get_metadata", null, 5000, cts.Token));
            Assert.Contains("just took over", ex.Message, StringComparison.Ordinal);

            var (promoted, _) = await _follower.StatusAsync(cts.Token);
            Assert.True(promoted);
        }

        // Deliberately NOT tested: the 5s send-cap abort path. Windows dynamic send buffering
        // accepts multi-MB sends into kernel buffers regardless of the receiver's window (verified
        // empirically: 8MB against a non-reading 4KB-buffer peer completes instantly), so a stalled
        // SendAsync cannot be reproduced deterministically on loopback. The cap remains as a guard
        // for genuine sustained backpressure; the frozen-plugin case is handled by the reply
        // timeout, which does not hold the send lock.

        [Fact]
        public async Task Invoke_WithoutPlugin_FailsWithGuidance()
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            var ex = await Assert.ThrowsAsync<InvalidOperationException>(
                () => _leader.InvokeAsync("get_metadata", null, 5000, cts.Token));
            Assert.Contains("Webority Figma MCP", ex.Message, StringComparison.Ordinal);
        }

        // Mirrors the plugin protocol: read {id, command, params}, answer {id, result} — or
        // {id, error} for the "boom" command.
        private static async Task FakePluginLoopAsync(ClientWebSocket socket, CancellationToken cancellationToken)
        {
            var buffer = new byte[64 * 1024];
            while (socket.State == WebSocketState.Open)
            {
                WebSocketReceiveResult received;
                try
                {
                    received = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);
                }
                catch (WebSocketException)
                {
                    return;
                }
                if (received.MessageType == WebSocketMessageType.Close)
                {
                    return;
                }
                var envelope = JsonNode.Parse(Encoding.UTF8.GetString(buffer, 0, received.Count));
                var command = envelope["command"].GetValue<string>();
                var reply = new JsonObject { ["id"] = envelope["id"].GetValue<string>() };
                if (command == "boom")
                {
                    reply["error"] = "simulated plugin failure";
                }
                else
                {
                    var result = new JsonObject { ["echo"] = command };
                    if (envelope["params"]?["nodeId"] is JsonNode nodeId)
                    {
                        result["nodeId"] = nodeId.GetValue<string>();
                    }
                    reply["result"] = result;
                }
                var bytes = Encoding.UTF8.GetBytes(reply.ToJsonString());
                await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, endOfMessage: true, cancellationToken);
            }
        }

        private static int FreePort()
        {
            var probe = new TcpListener(IPAddress.Loopback, 0);
            probe.Start();
            var port = ((IPEndPoint)probe.LocalEndpoint).Port;
            probe.Stop();
            return port;
        }
    }
}
