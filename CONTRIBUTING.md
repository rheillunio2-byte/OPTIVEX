<div align="center">

<img src="images/jarvix-banner.svg" alt="JARVIX — AI Command Center" width="100%">

# Contributing to JARVIX

**Thank you for helping build a more honest, more useful assistant.**

<sub><a href="README.md">README</a> · <a href="#1-welcome">Welcome</a> · <a href="#7-development-environment-setup">Setup</a> · <a href="#14-pull-request-requirements">Pull requests</a> · <a href="#13-security-and-api-key-protection">Security</a></sub>

<img src="images/jarvix-divider.svg" alt="" width="100%">

</div>

## Contents

1. [Welcome](#1-welcome)
2. [Project vision](#2-project-vision)
3. [Development philosophy](#3-development-philosophy)
4. [Ways to contribute](#4-ways-to-contribute)
5. [Reporting bugs](#5-reporting-bugs)
6. [Requesting features](#6-requesting-features)
7. [Development environment setup](#7-development-environment-setup)
8. [Repository structure](#8-repository-structure)
9. [Branch naming](#9-branch-naming)
10. [Commit conventions](#10-commit-conventions)
11. [Coding standards](#11-coding-standards)
12. [AI integration guidelines](#12-ai-integration-guidelines)
13. [Security and API-key protection](#13-security-and-api-key-protection)
14. [Pull request requirements](#14-pull-request-requirements)
15. [Testing requirements](#15-testing-requirements)
16. [Documentation contributions](#16-documentation-contributions)
17. [License](#17-license)

## 1. Welcome

<img align="right" src="images/jarvix-ai-core.svg" alt="Animated JARVIX AI core" width="180">

Whether you are fixing a typo, reporting a bug or adding a feature, you are welcome here. You do not need to be an expert: JARVIX is written in plain JavaScript with no framework, no bundler and no runtime dependencies, so you can read most of it in an afternoon.

If this is your first open-source contribution, start with a small change: a documentation fix, a clearer error message or an issue you can reproduce. Ask questions in the issue or pull request; no question is too basic.

Please be kind and constructive in every interaction. Assume good intent, give specific feedback, and critique code rather than people. Harassment or discrimination of any kind is not acceptable.

<br clear="right">

## 2. Project vision

JARVIX aims to be a personal AI assistant that you can trust: one place for conversation, tasks, notes, files, history and activity, running on your own machine, with your own AI provider.

The parts that matter most to us:

- **Honesty.** The interface must always show what is real. Demo mode is labelled, local tools are described as local, and a feature is not called finished until it works.
- **Privacy.** Your data stays in your browser. API keys stay on the server and are never sent to the page.
- **Usefulness.** Local tools should work without any AI. AI should make the assistant better, not be required for basic things.
- **Craft.** The interface should be calm, fast, accessible and a pleasure to use.

The [Roadmap](README.md#roadmap) in the README separates what is implemented from what is only planned. Please keep it that way.

## 3. Development philosophy

- **Simple over clever.** Prefer a few readable lines to an abstraction. Keep the zero-dependency server and the no-build front end unless there is a strong reason to change them; if you think there is, open an issue first.
- **Small, focused changes.** One pull request should do one thing. Smaller changes are reviewed faster and are easier to revert.
- **Accessible by default.** Everything must be usable with a keyboard, have visible focus, have text alternatives, and respect `prefers-reduced-motion`.
- **Fail clearly.** Errors shown to users should say what happened and what to do next, without leaking internals or secrets.
- **Do not overclaim.** In code, UI text, documentation and pull requests, describe what the software does, not what we hope it will do.

## 4. Ways to contribute

You can help without writing code.

- **Report bugs** you find while using JARVIX.
- **Suggest features** or improvements to existing ones.
- **Improve documentation**: fix mistakes, add examples, clarify setup steps.
- **Test** on a browser, operating system or screen size we have not covered. Tests so far have used Chromium only.
- **Review** open pull requests and leave constructive comments.
- **Fix issues**, especially ones labelled `good first issue` or `help wanted` if those labels exist.
- **Improve accessibility**, for example by testing with a screen reader. This has not been tested yet and is very welcome.
- **Contribute design**: refine the interface or the SVG artwork in `images/`, keeping the original JARVIX identity.

## 5. Reporting bugs

Search [existing issues](https://github.com/rheillunio2-byte/JARVIX/issues) first, then open a new one with:

- **What happened** and **what you expected**.
- **Steps to reproduce**, as exact as you can make them.
- **Environment**: operating system, browser and version, Node.js version (`node -v`), and the JARVIX commit or version.
- **Mode**: demo mode, or which provider (Anthropic, OpenAI, compatible server) and model.
- **Evidence**: a screenshot, or the browser console and server log output.

> [!CAUTION]
> Remove API keys, tokens and personal data from anything you paste into an issue. If you find a security problem, do **not** open a public issue; see [Security](#13-security-and-api-key-protection).

## 6. Requesting features

Open an issue that describes:

- **The problem** you are trying to solve, before the solution.
- **Your proposed solution**, and alternatives you considered.
- **Who benefits** and how it fits the [vision](#2-project-vision).
- **Impact** on privacy, security, accessibility and the zero-dependency approach.

Larger features should be discussed and agreed in an issue before you write code, so that your time is not wasted.

## 7. Development environment setup

**Requirements:** Node.js 18 or newer and Git. You do not need an AI key to develop: demo mode and the mock servers used by the tests cover most work.

1. **Fork** the repository on GitHub, then clone your fork:

   ```bash
   git clone https://github.com/<your-username>/JARVIX.git
   cd JARVIX
   git remote add upstream https://github.com/rheillunio2-byte/JARVIX.git
   ```

2. **Start the app.** There is nothing to install:

   ```bash
   npm start          # or: npm run dev   (restarts on server changes)
   ```

   Open <http://127.0.0.1:3000>. Front-end files are served as they are, so refresh the page after editing.

3. **Optional: use a real provider.** Copy the example environment file and add one key:

   ```bash
   cp .env.example .env
   ```

   `.env` is git-ignored. Never commit it. See [Configuration](README.md#configuration).

4. **Run the unit tests:**

   ```bash
   npm test
   ```

5. **Optional: browser tests.** These need Playwright, which is not a project dependency:

   ```bash
   npm i -D playwright --no-save
   npx playwright install chromium
   npm run test:e2e
   ```

6. **Keep your fork up to date:**

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

## 8. Repository structure

```text
JARVIX/
├── images/            Screenshots and animated SVG artwork (README / CONTRIBUTING)
├── server/            Node.js server: static files, /api/*, provider adapters
│   └── providers/     anthropic.js · openai.js · shared.js · index.js
├── public/            The web app, served as-is
│   ├── css/           Styles: theme, layout, components, chat, motion
│   ├── js/            Logic: state, commands, intent, markdown, voice, orb, ...
│   │   └── ui/        Views and widgets: messages, composer, sidebar, settings, ...
│   └── assets/        Logo
├── tests/             Unit tests (node:test) and tests/e2e (Playwright)
├── docs/              Markdown documentation
├── scripts/           gen-docs.js regenerates docs/commands.md
└── .env.example       Documented configuration template
```

Useful starting points:

| If you want to… | Look at |
|---|---|
| Add or change a slash command | `public/js/commands.js` |
| Change how plain-English requests are understood | `public/js/intent.js` |
| Add an AI provider | `server/providers/` |
| Change how a view looks or behaves | `public/js/ui/views.js`, `public/css/` |
| Change Markdown rendering | `public/js/markdown.js` |

Scripts load in a fixed order from `public/index.html` and share a global `JX` namespace. If you add a file, add its `<script>` tag in the right place. See [docs/architecture.md](docs/architecture.md).

## 9. Branch naming

Branch from an up-to-date `main`, one branch per change, using a short lowercase name with a type prefix:

| Prefix | Use for | Example |
|---|---|---|
| `feat/` | New features | `feat/task-due-dates` |
| `fix/` | Bug fixes | `fix/stream-abort-error` |
| `docs/` | Documentation only | `docs/setup-troubleshooting` |
| `refactor/` | Code changes with no behaviour change | `refactor/split-views-module` |
| `test/` | Adding or fixing tests | `test/unit-converter-edge-cases` |
| `chore/` | Tooling and housekeeping | `chore/update-gitignore` |

## 10. Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <short summary in the imperative>

<optional body: what and why, not how>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

```text
feat(tasks): add inline editing in the Tasks view
fix(server): return 413 for oversized request bodies
docs(readme): clarify demo mode behaviour
```

Keep the summary under about 72 characters, write it in the imperative ("add", not "added"), and reference issues in the body (`Fixes #12`). Make commits small enough that each one makes sense on its own.

## 11. Coding standards

**General**

- Plain, modern JavaScript (ES2020+ in the browser, Node 18+ on the server). No frameworks, bundlers or transpilers.
- **No new runtime dependencies** without prior discussion. The server uses only Node built-ins.
- Match the surrounding style: two-space indentation, single quotes, semicolons, descriptive names. Keep functions short and comment the *why*.

**Front end**

- Build DOM with the existing helpers (`el(...)`), not by concatenating HTML from user or model text.
- Anything rendered from user input or model output must be escaped. Markdown output goes through the existing sanitising renderer; do not add `innerHTML` with unescaped data.
- Store data under the `jarvix.v2.*` localStorage namespace through the state module, and keep a way to export and clear it.
- **Accessibility:** use semantic elements, labels and ARIA where needed, keep keyboard navigation and visible focus working, and keep contrast readable in both themes.
- **Motion:** animations must stop when the user asks for reduced motion. Use the existing motion settings rather than adding always-on animation.

**Server**

- Validate all input, keep the request-size limit, and return sanitised errors.
- Never log request bodies, prompts or keys.

**SVG artwork in `images/`**

- Complete `viewBox`, no JavaScript, no external resources, a sensible static state, and `prefers-reduced-motion` respected. Keep to the existing palette (deep black and navy with cyan, blue and violet accents).
- Artwork must be original. Do not add logos, characters or assets from other works.

## 12. AI integration guidelines

JARVIX talks to AI models only through the server. When you work on anything AI-related:

- **Keep keys on the server.** The browser calls `/api/chat`; it never receives or sends a provider key.
- **Stay provider-neutral.** Providers are small adapters that turn a request into an upstream call and yield text chunks. A new provider should be one new file in `server/providers/` registered in `index.js`, with the same streaming behaviour and the same sanitised errors.
- **Be honest about the source.** Replies from the demo responder must stay labelled as demo output, and AI-only commands must say they need a provider rather than fabricating an answer.
- **Treat model output as untrusted.** It is escaped and sanitised like any other text. Never execute it, and never render it as raw HTML.
- **Respect the user's data.** Send only what a request needs. Do not send error messages, demo replies or generated secrets to a model.
- **Handle failure.** Timeouts, rate limits, cancelled streams and upstream errors must produce a clear message and leave the app usable.
- **Test without a real key.** Use the mock servers in `tests/e2e/`. Do not make tests depend on a live provider.
- **Describe capabilities accurately.** If a model or provider behaves differently (for example, no streaming), document it instead of hiding it.

## 13. Security and API-key protection

- **Never commit secrets.** `.env` is git-ignored; keep it that way. Do not paste keys into code, tests, screenshots, issues or pull requests.
- If you accidentally expose a key, **revoke it with the provider immediately**, then remove it from the change. Deleting a commit does not make a leaked key safe.
- Use placeholders such as `your-key-here` in documentation and examples.
- Do not weaken the existing protections (Content-Security-Policy, same-origin checks, rate limiting, body-size limit, error sanitising) without a clear justification in the pull request.
- Do not add third-party scripts or network calls from the browser without discussion.
- **Report vulnerabilities privately.** Use GitHub's private vulnerability reporting on the repository's Security tab if it is enabled; otherwise contact the maintainer through their [GitHub profile](https://github.com/rheillunio2-byte) without posting details publicly. Please allow reasonable time for a fix before disclosure.

## 14. Pull request requirements

Before you open a pull request:

- [ ] The branch is based on the latest `main` and has a clear, focused scope.
- [ ] `npm test` passes, and `npm run test:e2e` passes if you changed the interface or server.
- [ ] New behaviour has tests; bug fixes have a test that failed before the fix.
- [ ] No secrets, personal data, large binaries or unrelated formatting changes are included.
- [ ] Documentation and `.env.example` are updated if behaviour or configuration changed. If you changed commands, run `node scripts/gen-docs.js`.
- [ ] The UI works with the keyboard and with reduced motion, in dark and light themes.
- [ ] You describe anything you could **not** test.
- [ ] No feature is described as complete in the README, UI or docs unless it works.

In the pull request description, explain **what** changed and **why**, link the issue (`Fixes #123`), and include screenshots or a short recording for visual changes. Draft pull requests are welcome for early feedback.

Reviews are done by volunteers, so please be patient. Expect questions and requests for changes; that is a normal part of the process, not criticism. Maintainers may ask you to split a large pull request.

## 15. Testing requirements

| Kind | Command | Covers |
|---|---|---|
| Unit | `npm test` | Calculator, unit converter, Markdown renderer, intent router, command registry, highlighter, local tools, server behaviour |
| End-to-end | `npm run test:e2e` | The real app in Chromium against mock AI servers |

- Tests use Node's built-in runner and need no dependencies. Playwright is needed only for the browser tests.
- Add a test with every behaviour change or fix. Keep tests deterministic: no real network calls, no real keys and no reliance on the current time unless it is controlled.
- Describe what you did **not** test. At the time of writing the project has not been tested with real provider keys, real microphone speech recognition, Safari, Firefox or screen readers; reports from those environments are very welcome.

See [docs/testing.md](docs/testing.md) for details.

## 16. Documentation contributions

Documentation is a first-class contribution.

- Write for a newcomer: short sentences, concrete steps, commands in code blocks.
- Keep it accurate. Verify commands and paths before documenting them, and never describe planned work as if it exists.
- Use relative links for files in the repository and keep screenshot filenames exactly as they are (`images/Chat.PNG`, `images/Activity.PNG`, `images/Files.PNG`, `images/History.PNG`, `images/Noted.PNG`, `images/Tasks.PNG`).
- Visual artwork lives in `images/`. The `docs/` folder holds text only.
- `docs/commands.md` is generated: change the command registry and run `node scripts/gen-docs.js` instead of editing it by hand.
- Use badges sparingly and only with real data.

## 17. License

JARVIX is released under the [MIT License](https://github.com/rheillunio2-byte/JARVIX?tab=MIT-1-ov-file). By submitting a contribution, you agree that it may be distributed under the same license, and you confirm that you have the right to contribute it.

<div align="center">

<img src="images/jarvix-divider.svg" alt="" width="100%">

<img src="images/jarvix-footer.svg" alt="JARVIX — Beyond Conversation. Into Intelligent Assistance." width="100%">

<sub>Thank you for contributing · <a href="README.md">Back to README</a></sub>

</div>
