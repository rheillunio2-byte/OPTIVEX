# Changelog

## [1.0.0-rc.2] — UI and usability pass (unbuilt: see docs/TESTING.md)

A design-system and workflow pass. No safety rule, data format or feature was removed.

### Added
- **Central design system** (`Views/Theme.xaml`): one place for colours, typography, card and button styles. Dark, consistent versions of controls that were still light: scroll bars, check boxes, text boxes, tooltips, data grids (row hover and selection), list items. Visible keyboard-focus rings everywhere. Documented in `docs/DESIGN.md`.
- **Responsive layout:** metric cards now reflow with the window (`AdaptivePanel`) and balance their rows (6 cards become 3+3, not 4+2) instead of being squashed into fixed columns. The column maths is in Core and unit-tested.
- **New shell:** vector line icons (no icon font needed), an active-page indicator, a sidebar that collapses to icons on narrow windows, a status footer (local-only note, version, and whether OPTIVEX is running as a standard user or administrator), and **Ctrl+1 to Ctrl+9** page shortcuts.
- **Smooth page transitions** (short fade and slide), skipped automatically when Windows animations are switched off.
- **Dark dialogs** replace the system message boxes. Long text (such as the cleanup preview) scrolls, "No" is the default for confirmations, Esc cancels, and the app falls back to a standard message box if a dialog ever fails.
- **Overview:** a dismissible first-run welcome card, five quick-action tiles (Analyze, Free up space, Review startup apps, Check a game, Battery and power) and a memory bar.
- **Actionable recommendations:** every recommendation has an "Open <page>" button that takes you to where you can act on it. OPTIVEX still changes nothing by itself.
- **Accessibility groundwork:** automation names on navigation items, tiles and dialogs; primary-button blue raised to at least 4.5:1 contrast with white text; focus rings.
- Tests: column maths (including a property test over many widths), recommendation-to-page mapping, welcome flag persistence and loading of settings files written by earlier versions. About 302 test cases in 202 methods in total.

### Fixed
- Test `ResultsAreSortedHighPriorityFirst` used a scenario that, correctly, produced too few recommendations (a battery at exactly 80% health is healthy). It now uses a scenario with one High, three Medium and one Low recommendation and asserts the ordering explicitly. Found by the first Windows test run (301 of 302 passed); the engine itself was correct.

### Changed
- Version is now 1.0.0-rc.2. Page templates use shared styles instead of repeated colour codes, and fixed-column grids became responsive panels.

### Verification performed without a compiler
The static suite described in docs/TESTING.md was extended and re-run: brace balance, type reachability, DI wiring, resource keys (every `StaticResource` exists and is defined before use), style-versus-element-type audit, and binding resolution including the new shell window. **No compilation or test run was possible in the authoring environment.** A later run by the project owner on Windows built Core, Data and the tests and passed 301 of 302 cases (the one failure was the test bug above). The WPF app and Infrastructure were not part of that output, and none of the new XAML has been rendered, so layout and appearance are unverified.


## [1.0.0-rc.1] — Release candidate (phases 5 and 6 unbuilt: see docs/TESTING.md)

First release candidate. It adds history, reports and settings on top of the phase work below, and finishes the documentation.

### Added
- **Reports page** backed by a local **SQLite history** (`history.db`): system scans, storage scans (category totals only, no file names), cleanups, optimization actions and analyses. Previous scan dates, **comparison of any scan with the one before it**, and empty/unavailable states.
- **Export:** readable **text** report, **CSV** of the table you are viewing (RFC 4180 quoting; spreadsheet formula-injection protection), and **PDF** through the Windows print dialog ("Microsoft Print to PDF"), so no PDF library is needed.
- **Settings page:** history on/off, retention (30 / 90 / 365 days / forever, applied at start-up), live refresh speed (1 / 2 / 5 s), open data and log folders, clear history (confirmed), about and safety promises.
- New `OPTIVEX.Data` project (net8.0) holding the SQLite and settings stores so they are unit-tested on any OS.
- **Polish:** single-instance guard, unobserved-task and fatal-error logging, the app starts even if the history database cannot be opened, version taken from `Directory.Build.props`, removal of the last placeholder page.
- Documentation: new `docs/INSTALLATION.md`, `docs/THIRD_PARTY_NOTICES.md`, `docs/CATALOG.md`; rewritten README, CONTRIBUTING, ARCHITECTURE, FEATURES and TESTING.
- ~80 more unit tests (history recorder, SQLite store incl. SQL-injection attempt, settings, comparison, CSV, report text).

### Changed
- View models for System Health, Performance and Gaming Center read the refresh interval from Settings; Overview, Storage Cleaner and Performance record their results through `IHistoryRecorder`.
- README and docs now state exactly what has and has not been built or tested.

### Verification performed without a compiler
XML well-formedness of all XAML/project files; string-aware brace balance of all C# files; every project type reachable via `using`/namespace; DI constructor argument counts; every XAML binding resolves to a real member. **No compilation or test run was possible in the authoring environment.**

## [0.6.0-phase5] — Unreleased (unbuilt: see docs/TESTING.md)

### Added: Laptop Care
- **Battery diagnostics** from Windows (WMI, read-only, no admin needed): charge level and state (charging / on battery / plugged in), estimated runtime, design capacity, current full-charge capacity, cycle count, name and chemistry.
- **Battery health and wear estimate** (full-charge ÷ design capacity), shown **only when the figures are plausible**. Missing, zero or inconsistent values show "Unavailable" with the reason instead of a number. Capacities are summed across multiple batteries.
- Cycle count is shown only if the battery reports it; otherwise OPTIVEX says so and points to Windows' own battery report.
- **"Create Windows battery report"** button: runs `powercfg /batteryreport` after a confirmation and opens the HTML file from OPTIVEX's local reports folder. It only creates a new file; the opener refuses anything outside that folder.
- Power plan with laptop-aware advice, CPU/GPU temperatures with "Unavailable + reason", and a clearly labelled *general care* card.
- **Desktops** show "No battery detected" and the reason; the power plan and temperature sections still work.

### Added: Optimization Intelligence (recommendation engine)
- **"Analyze my PC"** on the Overview page samples your PC for a few seconds (hardware, live metrics, two process samples, startup entries, power plan, visual effects, battery) and runs the rule engine.
- Every recommendation shows the six required fields: **issue, explanation, potential benefit, risk level, recommended action, reversible?**, plus a category and priority. Each is triggered by a measured value and quotes it (e.g. "Drive C:\ is 92% full (40 GB free)").
- Rules: low available RAM and low installed RAM, nearly full or low-space drives, many startup programs, CPU-heavy and memory-heavy programs, high CPU/GPU temperature, battery wear, power plan mismatches (High performance on battery, Power saver on AC), and visual effects on modest hardware.
- **Never advises ending Windows or security components**, never flags OPTIVEX itself, and never applies anything automatically.
- **"Not assessed" list:** anything that could not be read (a sensor that needs admin, a failed query, a missing battery value) is listed instead of guessed. One failing data source never aborts the analysis.
- Laptop Care uses the same engine restricted to battery, temperature and power-plan rules.
- ~65 more unit tests: battery health maths and state mapping, every engine rule (fires, does not fire, boundary values, required fields, sorting, category filtering) and the analyzer's fault tolerance, using fake providers.

### Changed
- `OverviewViewModel` takes a `SystemAnalyzer`; the Laptop Care placeholder is replaced by a real page. `IShellService` gained `OpenReport`. New `AppPaths` centralises OPTIVEX's local folders.

## [0.5.0-phase4] — Unreleased (unbuilt: see docs/TESTING.md)

### Added: Gaming
- **Gaming Center** with four views: *Dashboard* (detected CPU/GPU/RAM/free storage, live CPU, memory, CPU/GPU temperature and GPU load with "Unavailable + reason" for unsupported sensors, hardware-specific notes, and the resource use of any profile game that is running), *Game profiles*, *Game catalog* and *Add a game*.
- **Game profiles:** name, optional program (.exe, validated to exist) and notes. Running state and CPU/memory are matched by program name while the page is open. Removing a profile only removes OPTIVEX's record.
- **Searchable game catalog** showing, for every game: title, minimum and recommended CPU/GPU/RAM, storage, source, origin (Official / Secondary / User-provided) and last-verification date. Search ignores case and punctuation ("baldurs gate" finds "Baldur's Gate 3").
- **Manual game entry**, validated and always saved as *User-provided* and unverified. Stored on this PC only.
- **Game Compatibility page:** search, select, see the published requirements, and get one of the four required results with a component-by-component breakdown. RAM, free storage and Windows (64-bit / version) are checked automatically; CPU and GPU use *your own assessment* because model names can't be compared reliably. OPTIVEX never guesses and never predicts FPS.
- Honest handling of gaps: a figure the source doesn't publish is shown as "Not published" and does not count as a failure; if nothing verifiable can be checked the result is "Insufficient Information". Games that publish a higher RAM figure for integrated graphics (e.g. Minecraft: Java Edition) are handled.
- **Bundled catalog contains only entries read from official sources** (Baldur's Gate 3, Minecraft: Java Edition, verified 2026-11-12). See docs/CATALOG.md.
- ~70 more unit tests (compatibility logic, GPU/OS parsing, catalog search/add/remove, validators, advisor) including tests that validate the bundled catalog file itself.

### Changed
- `CompatibilityService` now takes a `HardwareProfile` and a `ManualAssessment`; `GameRequirement` gained source kind, source URL, verification date and notes. `CheckStatus` gained `NotPublished`.
- The "Game Compatibility" and "Gaming Center" placeholders are replaced by real pages.

## [0.4.0-phase3] — Unreleased (unbuilt: see docs/TESTING.md)

### Added: Storage
- **Recursive scanning** of an explicit allowlist: your temp folder, Chrome/Edge default-profile caches, shader (D3DSCache) and internet caches, and crash dumps. Files are categorised (Temporary files, Application caches, Log files, Crash dumps), shown with size, date and location, and sortable.
- **Select by category or by file.** Nothing is pre-selected.
- **Stronger safety:** reparse points (symlinks/junctions) are never followed, including in any parent folder; temp, log and dump files must be at least 24 h old; every file is re-validated at delete time (inside an approved root, no link in its path, not modified since the scan); the preview now lists totals per category and the largest items.
- **Large-file analyzer** (read-only, no delete capability): scan your user folder or any fixed drive for files above a size you choose (validated 10 to 1,000,000 MB), cancel at any time, "Show in folder".

### Added: Performance
- **Process monitor:** CPU and memory per program (instances combined), sortable, refreshed every 2 s while the page is open. Processes Windows won't let OPTIVEX inspect show "n/a", not 0. Windows and security components are labelled. There is no way to end a process from OPTIVEX.
- **Startup manager:** lists registry Run entries (user, all users, 32-bit) and Startup-folder items with publisher; enable/disable through the per-user `StartupApproved` keys (same mechanism as Task Manager). Reversible, needs no admin rights, deletes nothing. Windows Security/Defender entries are protected. Every change needs a confirmation that explains what happens.
- **Power plan and visual-effects advice** (read-only) with laptop-aware wording.
- **"What stands out right now"** observations based on the live reading (heavy CPU process, high memory with its biggest user, many startup entries) with honest "single reading" wording.
- ~60 new unit tests (cleanup policy, file kinds, process grouping, analyzer, startup encoding/safety/command parsing, powercfg parsing and advice).

### Changed
- `IStorageScanner.ScanAsync` now returns `StorageScanResult` (candidates, truncated flag, inaccessible count). Candidate list is capped at 20,000 files; the UI says so when it happens.

## [0.3.0-phase2] — Unreleased (unbuilt: see docs/TESTING.md)

### Added
- **System Health page** with live monitoring (1 s refresh while the page is open; stops when you leave it): CPU, memory, process count, uptime, CPU/GPU temperature, GPU utilisation, two 60-second charts (LiveCharts2), hardware details (model, physical cores / logical processors, GPUs, motherboard, Windows build, architecture) and fixed-drive storage.
- **OPTIVEX's own CPU use is shown separately** from total system CPU.
- **Unsupported sensors are labelled with a reason** (for example "needs administrator rights") instead of showing a number. OPTIVEX does not self-elevate.
- Core logic with tests: `HealthThresholds` (display colouring heuristics, explicitly not vendor limits), `CpuUsageCalculator`, `SensorReading`/`LiveMetrics`.
- New packages: LiveChartsCore.SkiaSharpView.WPF 2.0.0-rc2, LibreHardwareMonitorLib 0.9.3, System.Diagnostics.PerformanceCounter 8.0.0.

### Fixed (after first real build)
- WPF project: added missing `using System.IO;` in `StorageCleanerViewModel` (WPF implicit usings exclude it). Core, Infrastructure and all 43 unit tests built and passed on the first Windows run.

### Changed
- `PageViewModel.OnNavigatedFrom` lets pages stop background work. `SystemSnapshot` gained optional physical-core, motherboard and architecture fields.

## [0.2.0-phase1] — Unreleased (unbuilt: see docs/TESTING.md)

### Fixed
- **Cleanup path check:** the old `StartsWith(root)` test had no directory-separator boundary, so a sibling folder such as `…\Temp2` could pass as being inside `…\Temp`. Replaced by `PathGuard` (separator boundary, `..` resolution, filesystem roots refused).
- **Memory usage:** when Windows did not report free memory the old code showed 100 % used. Usage is now `null` and displayed as "unavailable".
- **OS version** is read from `Win32_OperatingSystem` (distinguishes Windows 11) instead of `Environment.OSVersion`.
- **Drives:** only fixed drives are listed; GPU lists every adapter instead of the first one.
- Failures are logged instead of being silently swallowed.

### Changed
- Cleanup no longer runs from a single "delete everything listed" prompt. Users tick individual files, see a preview, and confirm. Nothing is selected by default; navigating to the page does not scan.
- Deletion re-validates every path (approved root, direct child, not a reparse point) before deleting.
- Compatibility verdicts now use the four spec outcomes; CPU/GPU are reported as *Unverified*. RAM uses a 10 % tolerance for Windows-reported memory.
- Architecture: MVVM (CommunityToolkit.Mvvm), dependency injection, Serilog file logging to `%LOCALAPPDATA%\OPTIVEX\logs`.
- UI: nine-page navigation shell, new original logo, busy/empty states.

### Added
- `tests/OPTIVEX.Tests` (xUnit): `PathGuard`, `CompatibilityService`, `ByteFormat`.
- `assets/logo.svg`, CHANGELOG, docs/ARCHITECTURE.md, docs/FEATURES.md.

### Not yet implemented
Everything on the Planned list in docs/FEATURES.md.
