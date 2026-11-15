<div align="center">

<img src="images/jarvix-banner.svg" alt="JARVIX — AI Command Center. Your Intelligence. Your Assistant. Your JARVIX." width="100%">

<img src="images/jarvix-typing.svg" alt="Chat, Tasks, Notes, Files, History, Activity" width="640">

<br>

<a href="https://github.com/rheillunio2-byte/JARVIX/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/rheillunio2-byte/JARVIX?style=flat-square&labelColor=0b1220&color=22d3ee&logo=github"></a>
<a href="https://github.com/rheillunio2-byte/JARVIX/network/members"><img alt="GitHub forks" src="https://img.shields.io/github/forks/rheillunio2-byte/JARVIX?style=flat-square&labelColor=0b1220&color=3b82f6&logo=github"></a>
<a href="https://github.com/rheillunio2-byte/JARVIX/issues"><img alt="GitHub issues" src="https://img.shields.io/github/issues/rheillunio2-byte/JARVIX?style=flat-square&labelColor=0b1220&color=14b8a6"></a>
<a href="https://github.com/rheillunio2-byte/JARVIX/pulls"><img alt="GitHub pull requests" src="https://img.shields.io/github/issues-pr/rheillunio2-byte/JARVIX?style=flat-square&labelColor=0b1220&color=8b5cf6"></a>
<a href="https://github.com/rheillunio2-byte/JARVIX?tab=MIT-1-ov-file"><img alt="License: MIT" src="https://img.shields.io/github/license/rheillunio2-byte/JARVIX?style=flat-square&labelColor=0b1220&color=22d3ee"></a>
<img alt="Top language" src="https://img.shields.io/github/languages/top/rheillunio2-byte/JARVIX?style=flat-square&labelColor=0b1220&color=3b82f6">
<img alt="Node.js 18 or newer" src="https://img.shields.io/badge/node-%E2%89%A518-14b8a6?style=flat-square&labelColor=0b1220&logo=nodedotjs&logoColor=white">

<br><br>

**Your Intelligence. Your Assistant. Your JARVIX.**

<sub>A personal AI assistant with a command-center interface — chat, tasks, notes, files, history and activity in one place.</sub>

<br>

<a href="#introduction">Introduction</a> ·
<a href="#application-preview">Preview</a> ·
<a href="#features">Features</a> ·
<a href="#technology-stack">Stack</a> ·
<a href="#installation-and-setup">Setup</a> ·
<a href="#roadmap">Roadmap</a> ·
<a href="#contributing">Contributing</a>

<img src="images/jarvix-divider.svg" alt="" width="100%">

</div>

## Introduction

<img align="right" src="images/jarvix-ai-core.svg" alt="Animated JARVIX AI core" width="240">

**JARVIX** is a personal AI assistant that runs as a local web application. You talk to it by typing or, if your browser supports it, by voice, and it sits alongside the things you actually work with: your tasks, notes, generated documents, past conversations and a log of what it has done.

It is inspired by the idea of a dependable digital assistant like the fictional JARVIS from *Iron Man*. It is an independent project and is not affiliated with or endorsed by Marvel or Disney; the name, logo and interface are original.

**The problem it tries to solve.** A plain chat box is disposable: you ask, you read, you copy the useful part somewhere else. JARVIX keeps the conversation next to the places that useful output ends up, and it ships with local tools (a calculator, a unit converter, task and note management, a password generator, document export) that work immediately, with or without an AI model.

**How it differs from an ordinary chatbot**

- **It is honest about the model.** With no AI provider configured, JARVIX runs in a clearly labelled *demo mode*. Its small rule-based responder is badged `DEMO · LOCAL RULES`, and AI-only commands say they need a provider instead of inventing an answer.
- **Keys never reach the browser.** The browser only talks to JARVIX's own `/api/*` endpoints; the provider API key stays on the server.
- **Everyday requests are handled locally.** Messages such as *"what time is it"* or *"add a task to call Sam"* are recognised and executed locally, and the reply shows how the message was interpreted.
- **Your data stays with you.** Conversations, tasks, notes and files are stored in your browser, not on a remote service.

The long-term vision is an assistant that feels personal and that you can trust to be clear about what it did and what it did not do. See the [Roadmap](#roadmap) for what is implemented today and what is only planned.

<br clear="right">

## Application Preview

<div align="center">

<img src="images/Chat.PNG" alt="JARVIX chat view: the animated AI core, a greeting, quick-action cards and the message box with command hints" width="900">

<sub><b>The command center.</b> The Chat view with the AI core, quick actions and the composer. The screenshot was taken in demo mode, so the status badge reads <code>DEMO</code>; with a provider configured it reads <code>LIVE</code>.</sub>

</div>

## Features

<div align="center">

<table>
<tr>
<td width="50%" align="center"><b>Chat</b><br><img src="images/Chat.PNG" alt="Chat view" width="420"><br><sub>Conversations with the assistant, slash commands and voice input.</sub></td>
<td width="50%" align="center"><b>Activity</b><br><img src="images/Activity.PNG" alt="Activity view" width="420"><br><sub>A log of commands and actions with summary counters.</sub></td>
</tr>
<tr>
<td width="50%" align="center"><b>Files</b><br><img src="images/Files.PNG" alt="Files view" width="420"><br><sub>Documents created with <code>/document</code>.</sub></td>
<td width="50%" align="center"><b>History</b><br><img src="images/History.PNG" alt="History view" width="420"><br><sub>Every saved conversation, searchable and exportable.</sub></td>
</tr>
<tr>
<td width="50%" align="center"><b>Notes</b><br><img src="images/Noted.PNG" alt="Notes view" width="420"><br><sub>Personal notes with search, kept in your browser.</sub></td>
<td width="50%" align="center"><b>Tasks</b><br><img src="images/Tasks.PNG" alt="Tasks view" width="420"><br><sub>A to-do list with All, Open and Done filters.</sub></td>
</tr>
</table>

</div>

### AI Chat

- Streaming replies from **Anthropic Claude**, **OpenAI**, or any **OpenAI-compatible** server (Ollama, LM Studio, OpenRouter, vLLM, Groq and similar), through a server-side proxy.
- Conversation context is sent with each request, so follow-up questions work. Errors, demo replies and generated passwords are never sent to the model.
- **39 slash commands** with animated autocomplete and typo correction (`/sumarize` becomes `/summarize`). Local commands run in the browser; AI commands (`/translate`, `/code`, `/explain`, `/quiz` …) use your provider. The full list is in [docs/commands.md](docs/commands.md).
- Plain-English requests for local tasks (time, date, calculations, tasks, notes, unit conversion, documents), including follow-ups such as *"times 3"* after a calculation.
- Markdown rendering with tables, task lists, syntax-highlighted code with copy buttons, math, collapsible long replies, and interactive **flashcards** and **quizzes**.
- **Voice**: speech-to-text and text-to-speech through the browser's Web Speech API. The microphone only opens when you press the mic button (or <kbd>Alt</kbd>+<kbd>M</kbd>); it is never started automatically. Support depends on the browser.
- Stop generation, regenerate, edit-and-resend, copy, and export a conversation as Markdown, text or JSON.

### Activity

A running log of the commands and actions you have used, with counters for actions, conversations, open tasks, notes and files. It is stored in this browser only and can be cleared at any time.

### Files

Documents you create with `/document` (for example `/document Meeting Notes | Discuss launch | notes.md`) are downloaded and also listed here. From the list you can download a file again or remove it. The **Create document** button opens the chat with the command prefilled. Files are stored in your browser.

### History

All saved conversations in one list. Search across every conversation, export an individual one as Markdown, or delete everything with confirmation. The sidebar also lists recent conversations, with rename and delete.

### Notes

Create, edit, search and delete notes. Notes can also be added from chat with `/note add Title :: text` or by saying *"make a note that the deadline is Friday"*.

### Tasks

Add tasks, mark them done, edit them inline, delete them, and filter by All, Open or Done. From chat, use `/todo add …`, `/todo done 2`, or say *"add a task to call Sam"*.

### Also included

A command palette (<kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd>), keyboard shortcuts (press <kbd>?</kbd>), dark and light themes with six accent colours, adjustable font size, four animation levels (and no animation when your system asks for reduced motion), optional UI sounds, personality and response-length settings, full data export and import, and a responsive layout for phones and tablets.

## Technology Stack

| Layer | Technology |
|---|---|
| Interface | HTML5, CSS3 (custom properties, glassmorphism), vanilla JavaScript (no framework, no bundler) |
| Graphics | Canvas 2D for the AI core, ambient background and voice waveform |
| Voice and audio | Web Speech API (recognition and synthesis), Web Audio API (UI sounds, microphone level) |
| Storage | Browser `localStorage` |
| Server | Node.js 18 or newer using only built-in modules (`http`, `fs`, `path`); **no npm dependencies** |
| Streaming | Server-Sent Events from the server to the browser |
| AI providers | Anthropic Messages API, OpenAI Chat Completions, OpenAI-compatible endpoints |
| Fonts | Manrope and DM Mono from Google Fonts (optional; system fonts are used if unavailable) |
| Tests | Node's built-in test runner (`node:test`) for unit tests; Playwright with Chromium for end-to-end tests (optional, development only) |

## Installation and Setup

**Requirements:** Node.js 18 or newer. A provider API key is optional.

```bash
git clone https://github.com/rheillunio2-byte/JARVIX.git
cd JARVIX
npm start
```

Open <http://127.0.0.1:3000>.

There is nothing to install: JARVIX has no dependencies, so `npm install` is not required. There is also no build step; the files in `public/` are served as they are.

Without further setup JARVIX starts in **demo mode**. Local tools work normally; chat replies come from the labelled rule-based responder.

### Connect an AI provider

```bash
cp .env.example .env
```

Edit `.env` and fill in **one** provider, then restart the server. The status badge in the sidebar changes to **Live**; **Settings → AI connection → Test connection** confirms that the provider answers.

```ini
# Anthropic Claude
JARVIX_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-key-here

# or OpenAI
# JARVIX_PROVIDER=openai
# OPENAI_API_KEY=your-key-here

# or a local / OpenAI-compatible server, for example Ollama
# JARVIX_PROVIDER=compatible
# JARVIX_BASE_URL=http://localhost:11434/v1
# JARVIX_MODEL=llama3.1
```

> [!IMPORTANT]
> `.env` is listed in `.gitignore`. Never commit real keys. JARVIX has no user authentication, so keep `HOST` on `127.0.0.1` unless you put it behind a reverse proxy that authenticates users.

### Scripts

| Command | Purpose |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with automatic restart on file changes (`node --watch`) |
| `npm test` | Run the unit tests |
| `npm run test:e2e` | Run the browser tests (needs `npm i -D playwright` and `npx playwright install chromium`) |

## Project Structure

```text
JARVIX/
├── images/                 Screenshots and animated SVG artwork used by this README
├── server/
│   ├── server.js           HTTP server, static files, /api/status, /api/chat (SSE), /api/test
│   ├── config.js           .env and environment loading
│   └── providers/          anthropic.js · openai.js · shared.js · index.js
├── public/                 The web app (served as-is)
│   ├── index.html
│   ├── css/                theme · layout · components · chat · motion
│   ├── js/                 util, calc, units, highlight, markdown, tools, state, theme,
│   │                       ai, intent, demo, sound, orb, voice, commands, chat, main
│   │   └── ui/             core, messages, composer, sidebar, views, settings, palette
│   └── assets/logo.svg
├── tests/                  Unit tests (node:test) and tests/e2e (Playwright)
├── docs/                   Written documentation (Markdown only)
├── scripts/gen-docs.js     Regenerates docs/commands.md from the command registry
├── .env.example
├── package.json
├── CONTRIBUTING.md
└── LICENSE
```

More detail is in [docs/architecture.md](docs/architecture.md), [docs/providers-and-security.md](docs/providers-and-security.md) and [docs/testing.md](docs/testing.md).

## Configuration

Copy [`.env.example`](.env.example) to `.env`. All variables are optional; with none set, JARVIX runs in demo mode.

| Variable | Default | Description |
|---|---|---|
| `JARVIX_PROVIDER` | first configured | `anthropic`, `openai` or `compatible` |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | Model name |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model name |
| `JARVIX_BASE_URL` | — | Base URL of an OpenAI-compatible server (for example `http://localhost:11434/v1`) |
| `JARVIX_MODEL` | — | Model name for the compatible server |
| `JARVIX_API_KEY` | — | Key for the compatible server (often not needed locally) |
| `PORT` | `3000` | Port to listen on |
| `HOST` | `127.0.0.1` | Interface to bind; keep on loopback unless you add authentication |
| `JARVIX_TIMEOUT_MS` | `60000` | Timeout for provider requests |
| `JARVIX_RATE_LIMIT` | `60` | Chat requests per minute per client |
| `JARVIX_ALLOWED_ORIGINS` | — | Extra origins allowed to send POST requests (rarely needed) |

`ANTHROPIC_BASE_URL` and `OPENAI_BASE_URL` can also be set to route those providers through a gateway.

## Roadmap

**Implemented today**

- [x] Streaming chat through a server-side proxy (Anthropic, OpenAI, OpenAI-compatible)
- [x] Labelled demo mode with real local tools
- [x] 39 slash commands and plain-English routing for local tasks
- [x] Tasks, notes, files, history and activity views
- [x] Browser-based voice input and spoken replies (push-to-talk)
- [x] Themes, accent colours, animation levels and reduced-motion support
- [x] Conversation, settings and full-data export and import

**Planned — not implemented yet**

- [ ] Longer-term conversation memory beyond the current context window
- [ ] Hands-free voice interaction (continuous listening, wake phrase)
- [ ] Richer task management: due dates, priorities and reminders
- [ ] Optional authentication for running JARVIX on a shared server
- [ ] Productivity integrations such as calendar or email (none exist today)
- [ ] Tool use, so the assistant can act on tasks and notes by itself rather than only by command
- [ ] Installable offline-capable app

Ideas and priorities are discussed in [issues](https://github.com/rheillunio2-byte/JARVIX/issues).

## Contributing

Contributions of all sizes are welcome: bug reports, ideas, documentation fixes and code. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, conventions and pull request checklist before you start.

## License

JARVIX is released under the [MIT License](https://github.com/rheillunio2-byte/JARVIX?tab=MIT-1-ov-file).

<div align="center">

<img src="images/jarvix-divider.svg" alt="" width="100%">

<img src="images/jarvix-footer.svg" alt="JARVIX — Beyond Conversation. Into Intelligent Assistance." width="100%">

<sub>Built by <a href="https://github.com/rheillunio2-byte">Rheil Evans Lunio</a> · Released under the MIT License</sub>

</div>
