// Webority Figma Write MCP v1.0.0: local WebSocket bridge between the MCP server and the Figma plugin.
//
// Security model (the part weborityos's read-only bridge lacks, and a write bridge cannot skip):
//   1. Loopback only: listens on 127.0.0.1 and ::1, never a network interface.
//   2. Host check: every HTTP request / upgrade must name localhost, 127.0.0.1 or [::1] on our port.
//      This blocks DNS-rebinding pages that point an attacker hostname at 127.0.0.1.
//   3. Origin check: a browser always sends Origin. Only "null" (Figma's sandboxed plugin iframe)
//      is accepted. Non-browser clients can forge Origin, which is why 4 exists.
//   4. Token, proven both ways and never sent: the plugin opens with {hello, nonce}; the bridge answers
//      {type:"auth-challenge", proof: HMAC(token, "server|"+pluginNonce), nonce}; the plugin checks the
//      proof (so a program squatting on the port learns nothing and cannot drive the file) and replies
//      {auth: HMAC(token, "plugin|"+bridgeNonce)}. A wrong or missing answer closes with 4401.
//   5. One plugin at a time: writes must never silently land in a different file. A panel that asks
//      for a free session ({auth, claim:"free"}) is closed with 4409 when this bridge already has a
//      plugin, and moves on to the next port. Without a claim, a newly authenticated plugin replaces
//      the old one, which is closed with 4000.
//   7. Several sessions at once: each bridge binds the first free port of its list (3692-3699 by
//      default), and each Figma file's panel pairs with one session that has no file yet.
//   6. Panel requests ({type:"panel", id, action, params}) come only from the authenticated current
//      plugin and go to the server's onPanelRequest hook, which allows a fixed set of actions.

import http from "node:http";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";

export const CLOSE_REPLACED = 4000;
export const CLOSE_BAD_TOKEN = 4401;
export const CLOSE_BUSY = 4409;

export class FigmaWriteBridge {
  constructor({ port, ports, token, label = "Claude", allowedOrigins = ["null"], log = () => {} }) {
    this.ports = ports?.length ? [...ports] : [port];
    this.port = this.ports[0];
    this.label = label;
    this.token = token;
    this.allowedOrigins = allowedOrigins;
    this.log = log;
    this.servers = [];
    this.plugin = null; // { socket, state }
    this.pending = new Map();
    this.seq = 0;
    this.bound = false;
    this.bindError = null;
    this.waiters = new Set(); // resolvers waiting for a plugin to authenticate
  }

  // Binds if needed, then waits up to waitMs for a plugin. The panel rescans its ports every 2s, so right
  // after a lazy bind it has not said hello yet; deciding "offline" before then is wrong.
  async ensureConnected(waitMs = 4500) {
    if (!this.bound && !(await this.start())) return false;
    if (this.plugin) return true;
    if (waitMs <= 0) return false;
    return await new Promise((resolve) => {
      const done = (ok) => { clearTimeout(timer); this.waiters.delete(done); resolve(ok); };
      const timer = setTimeout(() => done(false), waitMs);
      this.waiters.add(done);
    });
  }

  // Fails every request still waiting on a socket that has gone away.
  #rejectPendingFor(ws, why) {
    for (const [id, p] of this.pending) {
      if (p.socket !== ws) continue;
      this.pending.delete(id);
      p.reject(new Error(why));
    }
  }

  get allowedHosts() {
    const p = String(this.port);
    return new Set([`localhost:${p}`, `127.0.0.1:${p}`, `[::1]:${p}`]);
  }

  // Concurrent callers (several tool calls arriving together) share one bind attempt.
  start() {
    if (this.bound) return Promise.resolve(true);
    if (!this.starting) this.starting = this.#bind().finally(() => { this.starting = null; });
    return this.starting;
  }

  // Tries each port in order and keeps the first that is free, so several sessions can run at once.
  async #bind() {
    for (const port of this.ports) {
      this.port = port;
      if (await this.#bindPort()) return true;
      if (!this.lastBindBusy) break;
    }
    this.port = this.ports[0];
    if (this.lastBindBusy) {
      const range = this.ports.length > 1 ? `Ports ${this.ports[0]}-${this.ports[this.ports.length - 1]} are all` : `Port ${this.ports[0]} is already`;
      this.bindError = `${range} in use (other Claude sessions are probably using Webority Figma Write). Use one of those sessions, or close one and retry.`;
    }
    return false;
  }

  async #bindPort() {
    this.lastBindBusy = false;
    const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 * 1024 });
    this.wss = wss;
    const make = () => {
      const server = http.createServer((req, res) => {
        // No HTTP API at all: nothing to call, nothing to rebind onto.
        res.writeHead(this.hostAllowed(req) ? 404 : 421, { "Content-Type": "text/plain" });
        res.end();
      });
      server.on("upgrade", (req, socket, head) => this.onUpgrade(req, socket, head));
      return server;
    };
    try {
      const v4 = make();
      await listen(v4, "127.0.0.1", this.port);
      this.servers.push(v4);
      const v6 = make();
      try {
        await listen(v6, "::1", this.port);
        this.servers.push(v6);
      } catch (e) {
        // IPv6 loopback unavailable on some machines; Figma may resolve localhost to ::1, so warn.
        this.log(`[bridge] IPv6 loopback not bound (${e.code}); plugin must reach 127.0.0.1`);
      }
      this.bound = true;
      this.bindError = null;
      this.log(`[bridge] listening on localhost:${this.port}`);
      return true;
    } catch (e) {
      await this.stop();
      this.lastBindBusy = e.code === "EADDRINUSE";
      this.bindError = this.lastBindBusy
        ? `Port ${this.port} is already in use (another Claude session is probably using Webority Figma Write). Use that session, or close it and retry.`
        : `Could not start the bridge on port ${this.port}: ${e.message}`;
      return false;
    }
  }

  async stop() {
    // Drop sockets first: server.close() waits for open connections, and a plugin that
    // reconnects in the meantime would otherwise keep this process alive forever.
    for (const s of this.servers) s.close();
    for (const c of this.wss?.clients ?? []) c.terminate();
    this.plugin?.socket.terminate();
    for (const s of this.servers) s.closeAllConnections?.();
    for (const [id, p] of this.pending) { this.pending.delete(id); p.reject(new Error("The bridge stopped.")); }
    this.servers = [];
    this.plugin = null;
    this.bound = false;
  }

  hostAllowed(req) {
    return this.allowedHosts.has(String(req.headers.host || "").toLowerCase());
  }

  onUpgrade(req, socket, head) {
    const reject = (status, why) => {
      this.log(`[bridge] rejected upgrade: ${why}`);
      socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    if (!this.hostAllowed(req)) return reject("421 Misdirected Request", `host ${req.headers.host}`);
    const origin = req.headers.origin;
    if (origin !== undefined && !this.allowedOrigins.includes(origin)) {
      return reject("403 Forbidden", `origin ${origin}`);
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.onSocket(ws, origin));
  }

  onSocket(ws, origin) {
    let authed = false;
    let bridgeNonce = null; // set once the hello arrives; the next message must answer it
    let helloVersion = null;
    const helloTimer = setTimeout(() => {
      if (!authed) ws.close(CLOSE_BAD_TOKEN, "no hello");
    }, 5000);

    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (!authed) {
        if (!bridgeNonce) {
          if (msg?.hello !== true || typeof msg.nonce !== "string" || !/^[0-9a-f]{32,128}$/.test(msg.nonce)) {
            ws.close(CLOSE_BAD_TOKEN, "bad hello");
            return;
          }
          bridgeNonce = crypto.randomBytes(32).toString("hex");
          helloVersion = msg.version ?? null;
          ws.send(JSON.stringify({ type: "auth-challenge", proof: hmac(this.token, "server|" + msg.nonce), nonce: bridgeNonce }));
          return;
        }
        if (tokenMatches(msg?.auth, hmac(this.token, "plugin|" + bridgeNonce))) {
          clearTimeout(helloTimer);
          const previous = this.plugin;
          // A panel looking for a free session never takes one that already drives a file.
          if (msg.claim === "free" && previous && previous.socket !== ws) {
            ws.close(CLOSE_BUSY, "session busy");
            return;
          }
          authed = true;
          this.plugin = { socket: ws, state: { origin: origin ?? "(none)", version: helloVersion } };
          if (previous && previous.socket !== ws) {
            previous.socket.close(CLOSE_REPLACED, "replaced by another plugin window");
            this.log("[bridge] plugin replaced by a newer window");
          }
          this.log("[bridge] plugin authenticated");
          ws.send(JSON.stringify({ type: "welcome", session: this.label, port: this.port }));
          for (const w of [...this.waiters]) w(true);
        } else {
          ws.close(CLOSE_BAD_TOKEN, "bad token");
        }
        return;
      }
      if (msg?.type === "state") {
        if (this.plugin?.socket === ws) this.plugin.state = { ...this.plugin.state, ...msg.state };
        return;
      }
      // The panel's own requests (the person's clicks in the Creative tab). Only the current plugin
      // may ask; a failing handler answers with an error and never drops the socket.
      if (msg?.type === "panel") {
        if (this.plugin?.socket !== ws || typeof msg.id !== "string") return;
        const answer = (body) => { try { ws.send(JSON.stringify({ type: "panel-reply", id: msg.id, ...body })); } catch { /* socket gone */ } };
        if (!this.onPanelRequest) return answer({ error: "This server does not take panel requests." });
        Promise.resolve()
          .then(() => this.onPanelRequest(String(msg.action || ""), msg.params && typeof msg.params === "object" ? msg.params : {}))
          .then((result) => answer({ result }), (e) => answer({ error: e instanceof Error ? e.message : String(e) }));
        return;
      }
      if (typeof msg?.id === "string" && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error != null) reject(new Error(String(msg.error)));
        else resolve(msg.result);
      }
    });

    ws.on("close", (code) => {
      clearTimeout(helloTimer);
      this.#rejectPendingFor(ws, code === CLOSE_REPLACED
        ? "The plugin was replaced by another Figma window before it answered."
        : code === 1009
          ? "The plugin's answer was larger than the 64 MB limit and the connection closed. Export smaller or at a lower scale."
          : "The Figma plugin disconnected before it answered (closed, reloaded or the file changed).");
      if (this.plugin?.socket === ws) {
        this.plugin = null;
        this.log("[bridge] plugin disconnected");
      }
    });
  }

  status() {
    return {
      bridge: this.bound ? `listening on localhost:${this.port}` : this.bindError ?? "not started",
      port: this.bound ? this.port : null,
      session: this.label,
      connected: !!this.plugin,
      ...(this.plugin ? this.plugin.state : {}),
    };
  }

  async request(command, params = {}, timeoutMs = 30000) {
    if (!(await this.ensureConnected()) && !this.bound) throw new Error(this.bindError);
    const plugin = this.plugin;
    if (!plugin) {
      throw new Error(
        "No Figma plugin connected. In Figma desktop (design editor, not Dev Mode) run Plugins > Development > 'Webority Figma MCP' and keep it open."
      );
    }
    const id = String(++this.seq);
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for the plugin to answer '${command}'.`));
      }, timeoutMs);
      this.pending.set(id, {
        socket: plugin.socket,
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
      });
      plugin.socket.send(JSON.stringify({ id, command, params }), (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(new Error("Could not send to the plugin: " + err.message));
        }
      });
    });
  }
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (e) => reject(e);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      resolve();
    });
  });
}

export function hmac(token, message) {
  return crypto.createHmac("sha256", token).update(message).digest("hex");
}

function tokenMatches(given, expected) {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
