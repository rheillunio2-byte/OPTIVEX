# Testing

## Unit tests — `npm test` (66 tests, Node's built-in runner)
Calculator (precedence, percent, unit suffixes, no-eval guarantees), unit conversion, syntax highlighting, Markdown safety and rendering, intent routing & typo tolerance, tools (random, password, counts, quiz/flashcard builders), the command registry (all advertised commands exist, AI commands never run with empty input, `/help` lists everything) and the HTTP server (headers, traversal, validation, SSE, error mapping).

## End-to-end — `npm run test:e2e` (227 checks, Chromium via Playwright)
Install the test tool separately (it is intentionally not an app dependency): `npm i -D playwright && npx playwright install chromium`.

The runner starts three processes: JARVIX in demo mode, JARVIX wired to `tests/e2e/mock-upstream.js` (an OpenAI-compatible streaming server that can fail on demand), and the mock itself.

Covered: boot without console errors · every local command and every AI command in demo mode (honest notice) · plain-English routing and follow-ups · interactive quiz/flashcards · Markdown/code safety · conversations (new, rename, search, switch, delete, clear-confirm, persistence across reload) · copy/edit/regenerate/export/import · autocomplete, history recall, palette and shortcuts · all views and settings tabs, theme/accent/font/animation changes, reduced motion · responsive layouts (phone/tablet/desktop) and horizontal-overflow checks · voice with stubbed `SpeechRecognition`/`speechSynthesis` (mic never started automatically, transcript → message, stop, permission errors, TTS, unsupported browsers) · server security headers, traversal, CORS, validation, 413 · live streaming, context carry-over, stop/partial, retry, 401/429, mid-stream drop, upstream outage, recovery.

Screenshots are written to `$JX_SHOTS` (default: OS temp dir).

## Not covered (be aware)
- Real Anthropic/OpenAI/Ollama endpoints and real API keys.
- Real microphone input and real speech-recognition services (stubbed in tests).
- Safari/Firefox rendering (Chromium only), screen readers, and very old browsers.
- Visual regression beyond manual screenshot review.
