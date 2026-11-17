# Testing

## Honest status

| What | Status |
|---|---|
| Unit tests exist for all decision logic | ✅ **302 test cases** (202 test methods; some are parameterised) |
| **Test run on Windows** (reported by the project owner, rc.2 suite) | ✅ `OPTIVEX.Core`, `OPTIVEX.Data` and the test project **built cleanly**; **301 of 302 passed**. The one failure was a mistake in a test (`ResultsAreSortedHighPriorityFirst` used a battery at exactly 80% health, which is correctly treated as healthy, so it produced too few recommendations). The engine was right; the test was fixed in this package and its scenario was checked against the engine rules by hand. |
| Phase 1 build and its 43 unit tests | ✅ built and passed on Windows (output was shared by the project owner) |
| Phases 2 to 4 | The project owner reported them working on Windows. Detailed build and test output was not shared. |
| Phase 5 and 6 **logic** (recommendation engine, battery maths, SQLite history, settings, reports, CSV) | ✅ compiled and tested on Windows as part of the run above |
| **Windows-specific and UI code for phases 5 and 6, and the whole rc.2 interface rewrite** (`OPTIVEX.Infrastructure` battery reader, the WPF `OPTIVEX.App`: views, theme, shell, dialogs, history/settings pages) | ❌ **not confirmed built or run**. `dotnet test` does not build the App project, and that output was not shared |
| **Appearance of the new UI** (theme, responsive panel, shell, dialogs) | ❌ **never rendered or seen**. Layout, spacing, colours and animations are unverified |
| Automated UI tests | ❌ none |
| Windows-specific code (WMI, sensors, registry, battery, performance counters) | ❌ only verifiable on real hardware; see the manual checklist |
| Accessibility (keyboard-only use, screen reader), high-DPI, small windows | ❌ not tested |

The authoring environment had no .NET SDK or Windows, so nothing here was run in it. What *was* done there: XML well-formedness of all XAML/project files, a string-aware brace-balance scan of every C# file, a check that every project type used in a file is reachable through a `using` or namespace, a check that dependency-injection constructor arguments match each view model, and a binding check that every XAML `{Binding}` resolves to a real property or generated command (including the shell window), a check that every `StaticResource` key exists and is defined before use, and an audit that no element has both a `Style` attribute and a `.Style` child and that each shared style is applied to the element type it targets. These catch typos, not logic errors.

## Run the automated tests

```powershell
dotnet test tests/OPTIVEX.Tests/OPTIVEX.Tests.csproj
```

The test project targets plain `net8.0` and references `OPTIVEX.Core` and `OPTIVEX.Data`, so it runs on any OS. It never touches your real folders (file tests use a temporary directory that is deleted afterwards).

### What the tests cover

| Area | Examples |
|---|---|
| Cleanup safety | directory-boundary bug (`Temp2` is not inside `Temp`), `..` traversal, drive roots, direct-child rule, age eligibility, categories |
| Compatibility | RAM tolerance, integrated-graphics RAM, OS parsing, all four verdicts, "not published" never counts as failure, no performance claims |
| Catalog | search ignoring punctuation, adding user games (forced to *User-provided*), duplicate titles, validators, the bundled `catalog.json` itself (source URL, date, valid) |
| Performance | process grouping, protected processes, analyzer wording, startup encoding, protected security entries, command-line parsing, `powercfg` parsing |
| Battery | health maths, plausibility rules, Win32 state mapping |
| Recommendation engine | each rule fires and does not fire, boundary values, required fields present, sorting, category filter, desktop (no battery), unreadable data → "not assessed" |
| System analyzer | fault tolerance with failing providers, two process samples, cancellation |
| History | recording rules, history off, failure isolation, retention, SQLite round-trips, newest-first, purge, clear, **SQL-injection attempt stored as data** |
| Settings | normalisation of invalid values, corrupt file → defaults, failed save leaves current settings unchanged |
| Layout | column maths for the responsive panel (balanced rows, narrow and invalid widths, property test over many widths), recommendation-to-page mapping, welcome flag persistence and older settings files |
| Reports | scan comparison, CSV quoting and **formula-injection protection**, table shapes, text report |

### What the tests do not cover
The WPF views and bindings, WMI/registry/sensor/battery readers, the real file system cleaner (its policy and path guard are tested; the delete loop is not), the print dialog, and anything needing specific hardware.

## Manual checklist

Use a **standard user account**. For anything destructive use a throw-away folder or VM, **never your real documents**. Tick each box; report failures with the log from `%LOCALAPPDATA%\OPTIVEX\logs`.

### Look and feel (rc.2). Please look at the app on a real screen
- [ ] Overall: dark navy background, cyan accents, nothing white or light grey unintended (scroll bars, check boxes, tooltips, tables, dialogs).
- [ ] Sidebar: nine icons render (none blank or a box); the active page has a bar and highlight; hover works; keyboard focus shows a cyan outline.
- [ ] Footer shows version and "Standard user" (or "Administrator" if elevated); the tooltip explains it.
- [ ] Resize the window from wide to about 880 px: cards reflow into fewer columns, rows stay balanced (no lone card where avoidable), nothing is cut off or overlaps; below about 1120 px the sidebar shows icons only.
- [ ] Ctrl+1 to Ctrl+9 jump to the pages; Tab reaches every button and Enter activates it.
- [ ] Page changes fade and slide in once, not repeatedly. Turn off Windows "Show animations" (Settings → Accessibility → Visual effects): the transition disappears.
- [ ] Dialogs (try Delete selected in Storage Cleaner with a throw-away file): dark, long previews scroll, **No** is the default, Esc cancels, Enter on the default button does nothing destructive.
- [ ] Overview: the welcome card appears on first run, "Got it" hides it permanently (still hidden after restart); quick-action tiles open the right pages; the memory card shows a bar.
- [ ] A recommendation's "Open …" button opens the right page and changes nothing by itself.
- [ ] Try 125 % and 150 % Windows display scaling: text stays readable, nothing is clipped. Report anything that is not.

### Start-up and navigation
- [ ] `dotnet build` has no errors; `dotnet test` all green. Paste any failure.
- [ ] App starts; the sidebar shows nine pages and highlights the active one; the logo shows.
- [ ] Starting a second copy shows "OPTIVEX is already running".
- [ ] After closing, `%LOCALAPPDATA%\OPTIVEX\logs` contains a log file.

### Overview and recommendations
- [ ] Hardware values match this PC (CPU, GPU(s), RAM, fixed drives only).
- [ ] "Analyze my PC" shows progress, then recommendations or "Nothing to recommend".
- [ ] Each recommendation shows category, priority, issue, explanation, potential benefit, risk, recommended action, reversible.
- [ ] Quoted numbers match reality (drive free space, memory % vs Task Manager, startup count vs Task Manager → Startup apps).
- [ ] A "Not assessed" list appears for unreadable items. Nothing on the PC changes. No advice to end a Windows or Defender process.

### System Health
- [ ] Charts draw (if not, send the error). CPU % moves under load and roughly matches Task Manager; memory matches.
- [ ] "OPTIVEX itself" stays near 0 to 2% when idle.
- [ ] Temperatures show a value or "Unavailable" with a reason; try once as administrator and note the difference.
- [ ] Leaving and returning to the page resumes updates; CPU use of OPTIVEX does not grow while on other pages.

### Storage Cleaner
- [ ] Scan lists categorised files; nothing is ticked; ticking a category ticks its files; counters update; columns sort (Size numerically).
- [ ] Create test files in `%TEMP%` and set their modified date 2+ days back: they are listed; newer ones are not.
- [ ] Delete shows a per-category preview. **No** changes nothing. **Yes** deletes, reports recovered space and skipped files; a file held open by another program is skipped.
- [ ] A junction inside `%TEMP%` pointing at a test folder: files inside the target are **not** listed or deleted.
- [ ] Large-file analyzer: bad input ("abc", 5) is rejected; scan lists large files; Stop returns partial results; "Show in folder" works; there is no delete button.

### Performance
- [ ] Processes: CPU shows "measuring…" once then plausible values; sort buttons work; protected components labelled; no kill option exists.
- [ ] Startup: entries match Task Manager → Startup apps. Disable a harmless entry → confirmation → Task Manager shows Disabled; Enable restores it. Windows Security entry cannot be toggled.
- [ ] Power tab shows your plan with advice; nothing changes any setting.

### Gaming Center and Game Compatibility
- [ ] Catalog lists Baldur's Gate 3 and Minecraft: Java Edition as *Official* with source and date; "baldurs gate" search finds the first.
- [ ] Compatibility with CPU/GPU on "Not sure" → *Insufficient Information* (or *Below Minimum* if RAM/storage/OS truly fail); "Meets minimum" for both → *Meets Minimum Requirements* when the rest pass. No FPS claims anywhere.
- [ ] On integrated graphics only, Minecraft's RAM check uses 12 GB.
- [ ] Add a profile with a real .exe: start the program and it appears under "Games running now"; bad input (blank name, missing file) is rejected.
- [ ] Add a game manually: invalid numbers rejected; valid game appears as *User-provided / Not verified*; survives restart; only your own entries can be removed.

### Laptop Care
- [ ] On a laptop: charge, state (plug/unplug changes it within about 5 s), runtime, capacities and health are plausible; cycle count shows a value or a reason.
- [ ] "Create Windows battery report" asks first, then opens an HTML file from `%LOCALAPPDATA%\OPTIVEX\reports`.
- [ ] On a desktop: "No battery detected", button disabled, power plan and temperatures still shown.

### Reports and Settings
- [ ] After a scan, an analysis and a cleanup, Reports shows entries in each tab with dates; selecting a system scan shows changes against the previous one.
- [ ] Export text opens as a readable report; Export CSV opens in Excel with correct columns; Print / save as PDF → "Microsoft Print to PDF" produces a PDF.
- [ ] Settings: switch history Off → new scans are not recorded; set retention; change refresh speed (applies when a live page is reopened); Clear history asks first and empties Reports; settings survive a restart.
- [ ] Delete `%LOCALAPPDATA%\OPTIVEX\settings.json` or damage it: the app still starts with defaults.

### Error handling
- [ ] Make `history.db` read-only or locked: the app still starts, Reports explains history is unavailable.
- [ ] Unplug/disable nothing important, but check that denied-access folders during scans do not crash anything.
