using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Models;

namespace OPTIVEX.Core.Reporting;

/// <summary>Holds the current settings and persists changes. Invalid values are normalised, never stored.</summary>
public sealed class SettingsService
{
    private readonly ISettingsStore _store;

    public SettingsService(ISettingsStore store)
    {
        _store = store;
        Current = store.Load().Normalize();
    }

    public AppSettings Current { get; private set; }
    public event EventHandler? Changed;

    public void Update(Func<AppSettings, AppSettings> change)
    {
        var next = change(Current).Normalize();
        _store.Save(next); // throws on failure, so Current never claims something that was not saved
        Current = next;
        Changed?.Invoke(this, EventArgs.Empty);
    }
}

/// <summary>
/// Records what the user did and saw into the local history, if history is switched on in Settings.
/// A history failure must never break the feature that triggered it, so errors go to onError and are swallowed.
/// </summary>
public sealed class HistoryRecorder : IHistoryRecorder
{
    private readonly IHistoryStore _store;
    private readonly Func<AppSettings> _settings;
    private readonly Action<Exception>? _onError;
    private readonly Func<DateTime> _clock;

    public HistoryRecorder(IHistoryStore store, Func<AppSettings> settings, Action<Exception>? onError = null, Func<DateTime>? clock = null)
    {
        _store = store; _settings = settings; _onError = onError; _clock = clock ?? (() => DateTime.Now);
    }

    private void Do(Action action)
    {
        if (!_settings().SaveHistory) return;
        try { action(); } catch (Exception ex) { _onError?.Invoke(ex); }
    }

    public void RecordSystemScan(SystemSnapshot s) => Do(() => _store.AddSystemScan(new SystemScanRecord(0, _clock(), s.ComputerName,
        s.WindowsVersion, s.CpuName, s.GpuName, s.LogicalProcessors, s.TotalRamGb, s.UsedRamGb, s.Drives)));

    /// <summary>Only totals per category are kept, not file names.</summary>
    public void RecordStorageScan(StorageScanResult r) => Do(() => _store.AddStorageScan(new StorageScanRecord(0, _clock(),
        r.Candidates.Count, r.Candidates.Sum(c => c.SizeBytes), r.Truncated,
        r.Candidates.GroupBy(c => c.Category).Select(g => new CategoryTotal(g.Key, g.Count(), g.Sum(c => c.SizeBytes))).ToList())));

    public void RecordCleanup(CleanupResult r, int selectedCount) =>
        Do(() => _store.AddCleanup(new CleanupRecord(0, _clock(), selectedCount, r.Deleted, r.Bytes, r.Skipped)));

    public void RecordOptimization(string action, string target, string details) =>
        Do(() => _store.AddAction(new OptimizationActionRecord(0, _clock(), action, target, details)));

    public void RecordAnalysis(RecommendationReport r) => Do(() => _store.AddAnalysis(new AnalysisRecord(0, _clock(),
        r.Items.Count, r.Items.Select(i => i.Issue).ToList(), r.NotAssessed)));

    /// <summary>Deletes history older than the retention setting (0 = keep everything). Runs even if saving is switched off.</summary>
    public void ApplyRetention()
    {
        var days = _settings().HistoryRetentionDays;
        if (days <= 0) return;
        try { _store.PurgeOlderThan(_clock().ToUniversalTime().AddDays(-days)); } catch (Exception ex) { _onError?.Invoke(ex); }
    }
}

/// <summary>Stands in when the history database cannot be opened, so the app still starts and says why history is missing.</summary>
public sealed class UnavailableHistoryStore : IHistoryStore
{
    public UnavailableHistoryStore(string reason) => Reason = reason;
    public string Reason { get; }
    public long AddSystemScan(SystemScanRecord r) => 0;
    public long AddStorageScan(StorageScanRecord r) => 0;
    public long AddCleanup(CleanupRecord r) => 0;
    public long AddAction(OptimizationActionRecord r) => 0;
    public long AddAnalysis(AnalysisRecord r) => 0;
    public HistoryData LoadAll(int limitPerTable = 500) => HistoryData.Empty;
    public int PurgeOlderThan(DateTime cutoffUtc) => 0;
    public void ClearAll() { }
}
