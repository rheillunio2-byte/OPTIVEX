# Feature status (release candidate 2)

Legend: ✅ implemented · 🟡 implemented with a stated limitation · ⬜ not implemented

**"Implemented" means the code is written and has unit tests where the logic is testable. Phases 1 to 4 were reported working on Windows by the project owner; phases 5 and 6 have not been built or run yet.** See [TESTING.md](TESTING.md).

## Overview and Optimization Intelligence
| Feature | Status | Notes |
|---|---|---|
| Hardware snapshot (CPU, GPU(s), RAM, fixed drives) | ✅ | WMI; fixed drives only |
| "Analyze my PC" recommendation engine | ✅ | Every item has issue, explanation, benefit, risk, action, reversible; quotes real measurements |
| Rules: low RAM / low installed RAM, full or low-space drives, many startup programs, CPU- or memory-heavy programs, high CPU/GPU temperature, battery wear, power-plan mismatch, visual effects on modest hardware | ✅ | Thresholds are display heuristics, not vendor limits |
| "Not assessed" list for anything that could not be read | ✅ | One failing data source never aborts the analysis |
| Applying recommendations automatically | ⬜ | Deliberately not provided |

## System Health
| Feature | Status | Notes |
|---|---|---|
| Live CPU, memory, processes, uptime; two 60 s charts | ✅ | Refresh speed set in Settings |
| OPTIVEX's own CPU shown separately | ✅ | |
| CPU / GPU temperature, GPU utilisation | 🟡 | LibreHardwareMonitor; often needs admin or is unsupported → "Unavailable" with reason |
| Core counts, motherboard, Windows build, architecture, GPU list | ✅ | |

## Storage Cleaner
| Feature | Status | Notes |
|---|---|---|
| Categorised scan (temp files, app caches, logs, crash dumps) | 🟡 | Allow-list only; Chrome/Edge **default profile** caches; list capped at 20,000 files |
| Select by file or category, sort, preview, confirm, delete | ✅ | Nothing pre-selected; 24 h minimum age for temp/log/dump files |
| Path safety (boundaries, `..`, drive roots, symlinks/junctions, re-validation at delete) | ✅ | Unit-tested |
| Recovered-space and cleanup results | ✅ | Also recorded in history |
| Large-file analyzer | ✅ | Read-only by construction (no delete code) |
| Quarantine / recycle-bin deletion, duplicate detection | ⬜ | Deletions are permanent and the preview says so |

## Performance
| Feature | Status | Notes |
|---|---|---|
| Per-program CPU and memory | ✅ | Protected Windows/security components labelled |
| Terminating processes | ⬜ | Deliberately not provided |
| Startup entries list with publisher | ✅ | Registry (user, all users, 32-bit) and Startup folders |
| Enable/disable startup entries | ✅ | Reversible; per-user `StartupApproved` only; Windows Security entries protected; confirmation with explanation |
| Per-program startup *impact* measurement | ⬜ | Not measured; OPTIVEX says so |
| Power-plan and visual-effects advice | ✅ | Read-only |
| Changing the power plan or visual effects | ⬜ | Advice only |

## Gaming
| Feature | Status | Notes |
|---|---|---|
| Gaming dashboard (hardware, live readings, hardware-specific notes) | ✅ | |
| Game profiles; resource use while a profile game runs | 🟡 | Matched by program name; launcher-started games may not match |
| Searchable catalog with all spec fields, source and verification date | 🟡 | **Two bundled entries**, both from official pages (see [CATALOG.md](CATALOG.md)) |
| Manual game entry (labelled User-provided) | ✅ | Validated; stored locally |
| Compatibility: RAM, free storage, Windows (64-bit/version) | ✅ | Handles higher RAM figure for integrated graphics |
| Compatibility: CPU and GPU | 🟡 | From **your own assessment**; model names are not compared automatically |
| Four result levels with per-component breakdown | ✅ | Hardware compatibility only; **no FPS prediction** |
| Automatic CPU/GPU model comparison | ⬜ | Needs trustworthy benchmark data |

## Laptop Care
| Feature | Status | Notes |
|---|---|---|
| Battery charge, state, runtime | 🟡 | Provided by Windows; may be missing |
| Design / full-charge capacity, health and wear estimate | 🟡 | Shown only when values are plausible; otherwise "Unavailable" with reason |
| Cycle count | 🟡 | Only if the battery reports it |
| Windows battery report button | ✅ | Runs `powercfg /batteryreport` after confirmation |
| Power plan, temperatures, laptop recommendations, general care tips | ✅ | |
| Desktop PCs | ✅ | "No battery detected" and the rest still work |

## Reports and History
| Feature | Status | Notes |
|---|---|---|
| SQLite history: system scans, storage scans, cleanups, optimization actions, analyses | ✅ | Local only; storage scans keep category totals, not file names |
| Previous scan dates; compare a scan with the one before it | ✅ | Differences only, no judgement |
| Export text, CSV (formula-injection safe) | ✅ | |
| Export PDF | 🟡 | Via the Windows print dialog ("Microsoft Print to PDF"); no built-in PDF writer |
| Retention setting, clear history, history on/off | ✅ | |
| Charts of historical trends | ⬜ | Table and comparison only |

## Settings, platform and quality
| Feature | Status | Notes |
|---|---|---|
| Settings page, single-instance guard, global error handling, rolling logs | ✅ | |
| Central design system (`Theme.xaml`): colours, type scale, card/button styles, dark controls, focus rings | ✅ | Unrendered; see [DESIGN.md](DESIGN.md) |
| Responsive layout (card reflow, collapsing sidebar) | ✅ | Column maths unit-tested; appearance unverified |
| Navigation: vector icons, active indicator, Ctrl+1 to Ctrl+9, status footer with privilege level | ✅ | |
| Page transition (respects Windows animation setting) | ✅ | |
| Dark dialogs with safe defaults (No is default, Esc cancels) and message-box fallback | ✅ | |
| Welcome card, quick-action tiles, "Open page" buttons on recommendations | ✅ | |
| Loading, empty and error states, tooltips, confirmation dialogs | ✅ | |
| Accessibility: focus rings, automation names, contrast-checked primary colours | 🟡 | No screen-reader or full audit; not tested at high DPI |
| Original logo | ✅ | `assets/logo.svg`, also drawn in the sidebar |
| Installer, code signing, auto-update | ⬜ | |
| Localization | ⬜ | English only |
| Automated UI tests | ⬜ | |
