# Installation

OPTIVEX has no installer yet. You build it from source, or publish a folder you can copy.

## Requirements

- Windows 10 (version 1607 or later, the .NET 8 baseline) or Windows 11, 64-bit.
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) to build. Check with `dotnet --version` (it should print 8.x).
- Internet access for the first `dotnet restore` (NuGet packages). OPTIVEX itself needs no internet at run time.

## Build and run from source

```powershell
cd OPTIVEX
dotnet restore
dotnet build -c Release
dotnet run --project src/OPTIVEX.App/OPTIVEX.App.csproj -c Release
```

Or open `OPTIVEX.sln` in Visual Studio 2022, set **OPTIVEX.App** as the startup project, and press F5.

## Run the tests

```powershell
dotnet test tests/OPTIVEX.Tests/OPTIVEX.Tests.csproj
```

## Publish a folder you can copy

Framework-dependent (small; the target PC needs the .NET 8 Desktop Runtime):

```powershell
dotnet publish src/OPTIVEX.App/OPTIVEX.App.csproj -c Release -r win-x64 --self-contained false -o publish
```

Self-contained (large; runs without installing .NET):

```powershell
dotnet publish src/OPTIVEX.App/OPTIVEX.App.csproj -c Release -r win-x64 --self-contained true -o publish
```

Run `publish\OPTIVEX.App.exe`. The build is **not code-signed**, so Windows SmartScreen may warn the first time.

## Standard user vs administrator

Run OPTIVEX normally. Everything works without administrator rights except CPU temperature on many PCs, which shows "Unavailable" with a reason. Running as administrator may make it appear. OPTIVEX never elevates itself.

## Where OPTIVEX stores data and how to uninstall

OPTIVEX writes only to `%LOCALAPPDATA%\OPTIVEX` (history database, settings, profiles, reports, logs). To uninstall, delete the folder you built or published and, if you want, delete `%LOCALAPPDATA%\OPTIVEX`. Nothing is written to the registry except the optional, reversible per-user startup switch you trigger yourself on the Performance page (it is in `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved`; re-enable any entry on the Performance page or in Task Manager).

## Troubleshooting

| Problem | What to try |
|---|---|
| `dotnet` is not recognised | Install the .NET 8 SDK, then open a new terminal. |
| Restore fails | Check your connection and that nuget.org is reachable; run `dotnet nuget locals all --clear` and retry. |
| Build errors | Please report them (with the full message). The first build of new phases may need small fixes. |
| "You must install .NET Desktop Runtime" when running a published build | Install the .NET 8 **Desktop** Runtime, or publish self-contained. |
| "OPTIVEX is already running" | Only one copy can run at a time. Check the taskbar and Task Manager. |
| CPU temperature shows "Unavailable" | Normal for many PCs. Try running as administrator once; some hardware never exposes it. |
| Antivirus warns about a driver | Sensor libraries use a low-level driver that some antivirus tools flag. OPTIVEX works without it; temperatures then show "Unavailable". |
| Charts look wrong or the Gaming Center page fails to open | Check `%LOCALAPPDATA%\OPTIVEX\logs` and report the message. |
| No history appears on Reports | Check Settings → *Save history* is On, then run a scan or analysis. |
