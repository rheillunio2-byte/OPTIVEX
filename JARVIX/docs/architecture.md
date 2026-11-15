# Architecture

```
Browser (public/)                                Node server (server/)                  Provider
─────────────────                                ───────────────────                    ────────
composer → chat.js ──plan──► slash command ─┐
                    └──────► intent router ─┤ local result  ──► messages.js (render)
                    └──────► free chat ─────┴─► ai.js ──POST /api/chat (SSE)──► server.js ──► providers/<id>.js ──► API
                                                    ◄── meta · delta* · done|error ─────────◄── async generator of text deltas
```

## Server

- `server.js` — static file server (path-traversal guarded, CSP and security headers) and `/api/*`:
  - `GET /api/status` → `{mode: live|demo, provider, model, providers[]}`; never returns secrets.
  - `POST /api/chat` → Server-Sent Events: `meta`, many `delta`, then `done` or `error`. A 15 s keep-alive comment prevents idle timeouts; client disconnect aborts the upstream request.
  - `POST /api/test` → one tiny completion for the “Test connection” button.
  - `POST|DELETE /api/session-key` → in-memory key for this server run (loopback clients only).
- `providers/` — each adapter exports `{id, label, stream(opts)}` as an **async generator yielding text deltas**. Adding a provider = one file + one line in `providers/index.js`.
- Errors are mapped to `{code, message}` (`auth`, `rate_limit`, `timeout`, `network`, `upstream`, `overloaded`, `too_large`, `bad_request`, `not_configured`); upstream bodies are never forwarded verbatim, so keys and internals cannot leak.

## Front end

Classic `<script>` files share one `JX` namespace and load in dependency order (see `index.html`). No bundler is needed.

| Layer | Modules |
|---|---|
| Pure logic (unit-tested in Node) | `util`, `calc`, `units`, `highlight`, `markdown`, `tools`, `intent`, `commands`, `state` |
| Services | `ai` (proxy client + status), `voice` (STT/TTS/level meter), `sound`, `theme`, `demo` |
| Visuals | `orb` (shared rAF loop: Orb, Ambient, Wave), `css/motion.css` |
| UI | `ui/core` (toasts, modals), `ui/messages`, `ui/composer`, `ui/sidebar`, `ui/views`, `ui/settings`, `ui/palette`, `chat` (controller), `main` (boot, shortcuts) |

### Request pipeline (`chat.js`)

1. `plan(text)` decides: slash command (typo-corrected) · local intent · free chat.
2. Commands return `{md}` (shown as `LOCAL`/`SYSTEM`), `{silent}`, or `{ai:{system,prompt}, fallback}`.
3. Free chat in **live** mode builds history (`contextMessages` excludes system notices, errors, demo replies and ephemeral output, merges to alternating roles) and streams. In **demo** mode the rule-based responder answers and is badged `DEMO`.
4. States drive the orb: `thinking` → `responding` (first delta) → `idle`; `listening` while the mic is open.

### State & storage

`state.js` keeps settings, conversations, tasks, notes, files and activity under `jarvix.v2.*` keys with debounced writes and a visible warning if storage is full/blocked. Legacy `jx_*` keys from v1 are migrated. Ephemeral messages (e.g. generated passwords) are never persisted or sent to the AI.

### Animation control

`<html data-anim="off|low|medium|high">` is set from settings and forced to `off` under `prefers-reduced-motion`. One `requestAnimationFrame` loop serves all canvases; it pauses when the tab is hidden and skips canvases that are off-screen.
