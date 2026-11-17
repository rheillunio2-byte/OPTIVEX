# Architecture

## Layers

```
OPTIVEX.App  ──────►  OPTIVEX.Infrastructure ─┐
 (WPF views,           (WMI, sensors, registry, │
  view models,          file system, battery)   ├──►  OPTIVEX.Core
  DI root)                                      │      (models, interfaces, pure logic;
     │                 OPTIVEX.Data ────────────┘       no Windows or package dependencies)
     └──────────────►  (SQLite + JSON stores)

OPTIVEX.Tests ──► Core + Data   (plain net8.0, runs anywhere)
```

- **Core** decides *what is safe* and *what to recommend*. Because it has no Windows dependency it is fully unit-tested.
- **Infrastructure** and **Data** implement Core's interfaces. **App** composes everything in `App.xaml.cs` and contains no decision logic.
- MVVM: each page is a `PageViewModel` rendered by an implicit `DataTemplate` in `Views/PageTemplates.xaml`. `MainViewModel` holds the ordered pages (registration order = sidebar order) and calls `OnNavigatedToAsync` / `OnNavigatedFrom`, which pages use to start and stop their timers.

## Principles that shape the code

1. **Unavailable is a value.** Anything that may not be readable is `SensorReading` (value *or* reason), `double?`, or a nullable context member. UI shows the reason; the recommendation engine lists it under "Not assessed". Nothing is defaulted to a plausible number.
2. **Safety is structural, not just checked.**
   - `ILargeFileAnalyzer` and `IProcessMonitor` have **no delete / terminate methods**.
   - The cleaner re-validates every path itself (allow-listed root, no reparse point in the path, still eligible) and does not trust the UI list.
   - The startup manager only writes per-user `StartupApproved` values.
3. **Advice never acts.** `RecommendationEngine` returns data; nothing in it can change the system.
4. **Failures stay local.** The analyzer reads each source in its own try/catch; the history recorder swallows (and logs) its own errors; a settings or database problem falls back to defaults or an "unavailable" store so the app always starts.
5. **Heuristics are named, isolated and tested.** `GpuClassifier`, `OsRequirementParser`, `HealthThresholds` and the engine's constants are display heuristics, not vendor limits, and are labelled as such.

## Key components

| Area | Components |
|---|---|
| Hardware | `HardwareScanner` (WMI snapshot), `LiveMetricsProvider` (performance counter, `GlobalMemoryStatusEx`, process deltas), `SensorService` (LibreHardwareMonitor wrapper) |
| Storage | `PathGuard` + `CleanupPolicy` (Core); `SafeStorageScanner`, `LargeFileAnalyzer` (Infrastructure) |
| Performance | `ProcessAggregator`, `PerformanceAnalyzer`, `StartupApprovedCodec`, `StartupSafety`, `CommandLine`, `PowerCfgParser`/`PowerAdvice` (Core); `ProcessMonitor`, `StartupManager`, `SystemSettingsReader` (Infrastructure) |
| Gaming | `GameRequirement` (with source, kind, verification date), `CompatibilityService`, `GameCatalog`, `GameValidator`, `GpuClassifier`, `GamingAdvisor`; `JsonGameStore` |
| Laptop | `BatteryHealth`, `BatteryStateMapper` (Core); `BatteryProvider`, `BatteryReportService` (Infrastructure) |
| Intelligence | `RecommendationEngine` (rules, pure), `SystemAnalyzer` (collects a `SystemContext` from providers, two process samples for CPU deltas) |
| History | `IHistoryStore` → `SqliteHistoryStore` (parameterised SQL, `user_version` schema), `HistoryRecorder` (rules: history on/off, privacy: totals not file names, retention), `UnavailableHistoryStore` fallback |
| Reporting | `ReportTables`, `ReportBuilder`, `CsvExporter` (RFC 4180 + formula-injection guard), `HistoryComparer`; PDF via the Windows print dialog (`WpfPrintService`) |
| Settings | `AppSettings.Normalize`, `SettingsService`, `JsonSettingsStore` (atomic write, defaults on corruption) |

## Data flow example: "Analyze my PC"

`OverviewViewModel.AnalyzeCommand` → `SystemAnalyzer.CollectAsync` (hardware, live metrics, process sample → 2 s → second sample, startup entries, power plan, visual effects, battery; each in its own try/catch) → `RecommendationEngine.Analyze(context)` → ordered `Recommendation`s plus `NotAssessed` → `RecommendationRow` display records → the implicit `RecommendationRow` template; the report is also given to `IHistoryRecorder`.

## Concurrency
Scans run on background tasks and report back through `await` on the UI thread. Live pages use a `PeriodicTimer` started in `OnNavigatedToAsync` and cancelled in `OnNavigatedFrom`. Providers that keep state between samples (`LiveMetricsProvider`, `ProcessMonitor`) lock internally.

## Extending
- **New rule:** add a method to `RecommendationEngine`, a category if needed, and tests for *fires*, *does not fire*, boundary and *unavailable data*.
- **New data source:** add an interface in Core, an implementation in Infrastructure/Data, register it in `App.xaml.cs`, and give it a failure path that produces a note instead of a crash.
- **New page:** add a `PageViewModel`, a `DataTemplate` in `PageTemplates.xaml`, and register it in the right sidebar position.
- **New cleanup location:** requires a safety review; edit `SafeStorageScanner.GetApprovedRoots` and add path tests. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## User interface layer (rc.2)

- **Design system:** `Views/Theme.xaml` holds every colour, type style, surface (`Card`, `CardInner`, `Chip`), button variant and the dark implicit styles for text boxes, check boxes, scroll bars, tooltips and data grids. `Views/PageTemplates.xaml` merges it, so it is available app-wide; `App.xaml` merges only `PageTemplates`. See [DESIGN.md](DESIGN.md).
- **Shell:** `MainWindow` shows the vector-icon sidebar, page header, the page (a `ContentControl` whose implicit `DataTemplate` is chosen by view-model type), and a status footer. It collapses the sidebar below 1120 px, plays a short transition when the page changes (skipped if Windows animations are off), and binds Ctrl+1 to Ctrl+9 to `MainViewModel.NavigateToIndexCommand`.
- **Navigation between pages:** `NavigationService` holds a callback set by `MainViewModel`, so pages can open other pages (recommendation buttons, quick-action tiles) without depending on the shell. This avoids a circular dependency (the shell depends on the pages).
- **Responsive cards:** `AdaptivePanel` measures and arranges children in a grid whose column count comes from `AdaptiveLayout.Columns` in Core (even splits preferred, no lone last-row card), so the logic is unit-tested without WPF.
- **Dialogs:** `WpfDialogService` shows `DialogWindow`; if that fails it falls back to a standard message box. Confirmations default to "No".
- **Icons:** 24x24 geometries in Theme.xaml, selected by page title through `PageIconConverter`, so no icon font is required.
