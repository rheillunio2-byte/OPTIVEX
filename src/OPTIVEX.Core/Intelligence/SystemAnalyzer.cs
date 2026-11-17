using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Models;

namespace OPTIVEX.Core.Intelligence;

/// <summary>
/// Gathers a SystemContext from the providers and runs the engine. Each data source is read independently:
/// one failing source never aborts the analysis, it just becomes a "not assessed" note.
/// </summary>
public sealed class SystemAnalyzer
{
    private readonly IHardwareScanner _hardware;
    private readonly ILiveMetricsProvider _live;
    private readonly IProcessMonitor _processes;
    private readonly IStartupManager _startup;
    private readonly ISystemSettingsReader _settings;
    private readonly IBatteryProvider _battery;
    private readonly TimeSpan _processWindow;

    public SystemAnalyzer(IHardwareScanner hardware, ILiveMetricsProvider live, IProcessMonitor processes, IStartupManager startup,
        ISystemSettingsReader settings, IBatteryProvider battery, TimeSpan? processWindow = null)
    {
        _hardware = hardware; _live = live; _processes = processes; _startup = startup; _settings = settings; _battery = battery;
        _processWindow = processWindow ?? TimeSpan.FromSeconds(2);
    }

    public async Task<RecommendationReport> AnalyzeAsync(CancellationToken ct = default) =>
        RecommendationEngine.Analyze(await CollectAsync(ct));

    public async Task<SystemContext> CollectAsync(CancellationToken ct = default)
    {
        var notes = new List<string>();
        async Task<T?> Try<T>(string what, Func<Task<T>> read) where T : class
        {
            try { return await read(); }
            catch (OperationCanceledException) { throw; }
            catch (Exception ex) { notes.Add($"{what}: {ex.Message}"); return null; }
        }

        var snapshot = await Try("Hardware scan", () => _hardware.ScanAsync(ct));
        var live = await Try("Live metrics", () => _live.SampleAsync(ct));

        // CPU use per program is a delta, so take two samples a short interval apart.
        IReadOnlyList<ProcessGroup>? groups = null;
        var snap = await Try("Process sampling", async () =>
        {
            _processes.Reset();
            await _processes.SampleAsync(ct);
            if (_processWindow > TimeSpan.Zero) await Task.Delay(_processWindow, ct);
            return await _processes.SampleAsync(ct);
        });
        if (snap is not null) groups = snap.Groups;

        var startup = await Try("Startup entries", () => Task.Run(() => _startup.GetEntries(), ct));
        var plan = await Try("Power plan", () => _settings.ReadPowerPlanAsync(ct));
        VisualEffectsInfo? visuals = null;
        try { visuals = _settings.ReadVisualEffects(); } catch (Exception ex) { notes.Add($"Visual effects: {ex.Message}"); }
        var battery = await Try("Battery", () => _battery.ReadAsync(ct));

        return new SystemContext(snapshot, live, groups, startup, plan, visuals, battery, notes);
    }
}
