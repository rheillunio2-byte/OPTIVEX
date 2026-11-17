using OPTIVEX.Core.Models;

namespace OPTIVEX.Core.Abstractions;

public interface IHardwareScanner
{
    Task<SystemSnapshot> ScanAsync(CancellationToken token = default);
}

public sealed record CleanupResult(int Deleted, long Bytes, int Skipped);

public interface IStorageScanner
{
    Task<StorageScanResult> ScanAsync(CancellationToken token = default);
    Task<CleanupResult> CleanSelectedAsync(IEnumerable<CleanupCandidate> selected, CancellationToken token = default);
}

/// <summary>Read-only. Finds big files so the user can decide; has no delete capability by design.</summary>
public interface ILargeFileAnalyzer
{
    IReadOnlyList<ScanScope> GetScopes();
    Task<LargeFileScanResult> FindAsync(ScanScope scope, long minBytes, int maxResults,
        IProgress<long>? progress = null, CancellationToken token = default);
}

/// <summary>Takes one live sample of system metrics. Unsupported readings come back as unavailable, never guessed.</summary>
public interface ILiveMetricsProvider
{
    Task<LiveMetrics> SampleAsync(CancellationToken token = default);
}

/// <summary>Observes processes. There is intentionally no way to terminate a process through this interface.</summary>
public interface IProcessMonitor
{
    /// <summary>Forget CPU baselines (call when monitoring resumes after a pause).</summary>
    void Reset();
    Task<ProcessSnapshot> SampleAsync(CancellationToken token = default);
}

public interface IStartupManager
{
    IReadOnlyList<StartupEntry> GetEntries();
    /// <summary>Reversibly enable/disable via the per-user StartupApproved keys (same mechanism as Task Manager).</summary>
    void SetEnabled(StartupEntry entry, bool enabled);
}

public interface ISystemSettingsReader
{
    Task<PowerPlanInfo> ReadPowerPlanAsync(CancellationToken token = default);
    VisualEffectsInfo ReadVisualEffects();
}

/// <summary>Persistence for the bundled catalog (read-only), user-entered games and game profiles.</summary>
public interface IGameStore
{
    IReadOnlyList<GameRequirement> LoadCatalog();
    IReadOnlyList<GameRequirement> LoadUserGames();
    void SaveUserGames(IReadOnlyList<GameRequirement> games);
    IReadOnlyList<GameProfile> LoadProfiles();
    void SaveProfiles(IReadOnlyList<GameProfile> profiles);
}

public interface IBatteryProvider
{
    Task<BatteryInfo> ReadAsync(CancellationToken token = default);
}

/// <summary>Asks Windows to write its own battery report (HTML) into OPTIVEX's local reports folder.</summary>
public interface IBatteryReportService
{
    /// <returns>Full path of the created report; throws InvalidOperationException with a readable message on failure.</returns>
    Task<string> CreateAsync(CancellationToken token = default);
}

/// <summary>Local history database. All data stays on this PC.</summary>
public interface IHistoryStore
{
    long AddSystemScan(SystemScanRecord r);
    long AddStorageScan(StorageScanRecord r);
    long AddCleanup(CleanupRecord r);
    long AddAction(OptimizationActionRecord r);
    long AddAnalysis(AnalysisRecord r);
    HistoryData LoadAll(int limitPerTable = 500);
    /// <returns>Number of rows removed.</returns>
    int PurgeOlderThan(DateTime cutoffUtc);
    void ClearAll();
}

public interface ISettingsStore
{
    AppSettings Load();
    void Save(AppSettings settings);
}

public interface IHistoryRecorder
{
    void RecordSystemScan(SystemSnapshot snapshot);
    void RecordStorageScan(StorageScanResult result);
    void RecordCleanup(CleanupResult result, int selectedCount);
    void RecordOptimization(string action, string target, string details);
    void RecordAnalysis(RecommendationReport report);
}
