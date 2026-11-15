# Command reference

> Generated from the command registry (`public/js/commands.js`) — run `node scripts/gen-docs.js` to refresh.

Type `/` in the message box for animated autocomplete. **AI** commands are sent to your configured provider through the server proxy; **Local** commands run entirely in your browser. In demo mode, AI commands tell you they need a provider rather than inventing an answer (a few have clearly-labelled local fallbacks, noted below).

## General

| Command | Type | What it does | Usage |
|---|---|---|---|
| `/help` | Local | Show available commands | `/help [command]` |
| `/clear` | Local | Clear the current conversation | `/clear` |
| `/time` | Local | Display the current time | `/time` |
| `/date` | Local | Display the current date | `/date` |
| `/about` | Local | Information about JARVIX | `/about` |
| `/settings` | Local | Open settings | `/settings [appearance\|assistant\|voice\|ai\|data]` |
| `/history` | Local | View & search conversation history | `/history [search]` |
| `/new` | Local | Start a new conversation | `/new` |
| `/export` | Local | Export this conversation (md, txt or json) | `/export [md\|txt\|json]` |
| `/status` | Local | Show connection & system status | `/status` |

## Productivity

| Command | Type | What it does | Usage |
|---|---|---|---|
| `/summarize`<br><small>aliases: /summarise, /tldr</small> | AI<br><small>demo fallback: extractive local summary</small> | Summarize provided text | `/summarize <text>` |
| `/rewrite`<br><small>aliases: /improve, /rephrase</small> | AI<br><small>demo fallback: basic spacing/capitalisation clean-up</small> | Rewrite and improve text | `/rewrite [instructions:] <text>` |
| `/translate` | AI | Translate text | `/translate to <language>: <text>` |
| `/write` | AI | Generate written content | `/write <what to write>` |
| `/ideas`<br><small>aliases: /brainstorm</small> | AI | Generate creative ideas | `/ideas <topic>` |
| `/explain`<br><small>aliases: /eli5</small> | AI | Explain concepts | `/explain <concept>` |
| `/todo`<br><small>aliases: /task, /tasks</small> | Local | Create and manage tasks | `/todo [add <task> \| list \| done <n> \| undo <n> \| rm <n> \| clear]` |
| `/note`<br><small>aliases: /notes</small> | Local | Create and manage notes | `/note [add <text> \| list \| show <n> \| rm <n> \| search <word>]` |
| `/document`<br><small>aliases: /doc, /file</small> | Local | Create a downloadable text/Markdown file | `/document <title> \| <content> \| <filename.txt>` |

## Development

| Command | Type | What it does | Usage |
|---|---|---|---|
| `/code` | AI | Generate code | `/code <what to build> [in <language>]` |
| `/debug` | AI | Analyze and troubleshoot code | `/debug <code and/or error message>` |
| `/review` | AI | Review code | `/review <code>` |
| `/html` | AI | Generate HTML | `/html <what to build>` |
| `/css` | AI | Generate CSS | `/css <what to style>` |
| `/javascript`<br><small>aliases: /js</small> | AI | Generate JavaScript | `/javascript <what to build>` |

## Education

| Command | Type | What it does | Usage |
|---|---|---|---|
| `/quiz` | AI<br><small>demo fallback: builds a quiz from "term: definition" lines you provide</small> | Generate an interactive quiz | `/quiz <topic> [number of questions]` |
| `/flashcards`<br><small>aliases: /flashcard, /cards</small> | AI<br><small>demo fallback: builds cards from "term: definition" lines you provide</small> | Generate flip-card flashcards | `/flashcards <topic> [count]` |
| `/study` | AI | Create study materials | `/study <topic>` |
| `/define` | AI | Define terms | `/define <term>` |
| `/compare`<br><small>aliases: /vs</small> | AI | Compare concepts | `/compare <A> vs <B>` |

## Utilities

| Command | Type | What it does | Usage |
|---|---|---|---|
| `/calculate`<br><small>aliases: /calc, /math</small> | Local | Perform mathematical calculations | `/calculate <expression>` |
| `/convert`<br><small>aliases: /unit, /units</small> | Local | Convert units | `/convert <value> <unit> to <unit>` |
| `/count`<br><small>aliases: /wc</small> | Local | Count words and characters | `/count <text>` |
| `/random`<br><small>aliases: /rand, /roll</small> | Local | Generate random values | `/random [max \| min max \| coin \| dice 2d6 \| pick a, b, c \| uuid \| hex n \| color]` |
| `/password`<br><small>aliases: /pass, /pw</small> | Local | Generate a secure random password locally | `/password [length] [nosymbols] [nonumbers] [noupper] [nolower]` |

## Interface

| Command | Type | What it does | Usage |
|---|---|---|---|
| `/shortcuts` | Local | Show keyboard shortcuts | `/shortcuts` |
| `/theme` | Local | Change the theme | `/theme [dark\|light\|system\|toggle] [accent]` |
| `/voice` | Local | Toggle voice features | `/voice [on \| off \| auto on\|off \| stop \| test \| status]` |
| `/animations`<br><small>aliases: /motion, /anim</small> | Local | Configure animation settings | `/animations [off \| low \| medium \| high \| status]` |

## Plain-English routing

Before a message goes to the AI, JARVIX checks whether it is really a local task (typo-tolerant): *what time is it*, *whats the date*, *add a task to call Sam*, *make a note that…*, *calculate 18% of 240*, *times 3* (continues the previous calculation), *convert 72 f to c*, *create a document titled …*, *help*. Routed messages show a small “Interpreted as /command” line so nothing happens invisibly.
