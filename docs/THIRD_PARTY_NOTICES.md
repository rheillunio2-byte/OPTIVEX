# Third-party notices

OPTIVEX is MIT licensed. It uses the open-source packages below. Licences are listed from each project's published metadata; **please confirm against the package pages before redistributing a build.**

| Package | Version | Licence | Used for |
|---|---|---|---|
| CommunityToolkit.Mvvm | 8.2.2 | MIT | MVVM helpers (observable properties, commands) |
| Microsoft.Extensions.DependencyInjection | 8.0.1 | MIT | Dependency injection |
| System.Management | 8.0.0 | MIT | WMI hardware queries |
| System.Diagnostics.PerformanceCounter | 8.0.0 | MIT | Total CPU counter |
| LibreHardwareMonitorLib | 0.9.3 | MPL-2.0 | CPU/GPU temperature and GPU load sensors |
| LiveChartsCore.SkiaSharpView.WPF (and SkiaSharp, HarfBuzzSharp) | 2.0.0-rc2 | MIT | Charts |
| Microsoft.Data.Sqlite (SQLitePCLRaw, SQLite) | 8.0.11 | MIT (SQLitePCLRaw: Apache-2.0; SQLite: public domain) | Local history database |
| Serilog, Serilog.Sinks.File | 3.1.1, 5.0.0 | Apache-2.0 | Logging |
| xunit, xunit.runner.visualstudio, Microsoft.NET.Test.Sdk | 2.6.6, 2.5.6, 17.8.0 | Apache-2.0 / MIT | Tests only |

## Game requirement data

Requirement figures in `src/OPTIVEX.App/Data/catalog.json` are factual specifications read from the publishers' own pages (see [CATALOG.md](CATALOG.md) for the URLs and dates). Game names are trademarks of their owners and appear only to identify the game. OPTIVEX is not affiliated with or endorsed by any game publisher.

## Why these packages

Each dependency replaces substantial code that would be risky to write by hand: sensor access (LibreHardwareMonitor), charting (LiveCharts2), and a database engine (SQLite). Add a new dependency only with a stated reason and a licence check (see [CONTRIBUTING.md](../CONTRIBUTING.md)).
