namespace OPTIVEX.Core.Models;

public sealed record CategoryTotal(string Category, int Files, long Bytes);

public sealed record SystemScanRecord(long Id, DateTime TakenAt, string ComputerName, string Windows, string Cpu, string Gpu,
    int LogicalProcessors, double TotalRamGb, double? UsedRamGb, IReadOnlyList<DriveSnapshot> Drives);

public sealed record StorageScanRecord(long Id, DateTime TakenAt, int Files, long TotalBytes, bool Truncated, IReadOnlyList<CategoryTotal> Categories);
public sealed record CleanupRecord(long Id, DateTime TakenAt, int Selected, int Deleted, long Bytes, int Skipped);
public sealed record OptimizationActionRecord(long Id, DateTime TakenAt, string Action, string Target, string Details);
public sealed record AnalysisRecord(long Id, DateTime TakenAt, int Recommendations, IReadOnlyList<string> Issues, IReadOnlyList<string> NotAssessed);

/// <summary>Everything in the local history, newest first within each list.</summary>
public sealed record HistoryData(
    IReadOnlyList<SystemScanRecord> SystemScans, IReadOnlyList<StorageScanRecord> StorageScans, IReadOnlyList<CleanupRecord> Cleanups,
    IReadOnlyList<OptimizationActionRecord> Actions, IReadOnlyList<AnalysisRecord> Analyses)
{
    public static HistoryData Empty { get; } = new(Array.Empty<SystemScanRecord>(), Array.Empty<StorageScanRecord>(),
        Array.Empty<CleanupRecord>(), Array.Empty<OptimizationActionRecord>(), Array.Empty<AnalysisRecord>());
}

/// <summary>User preferences. Values outside the allowed options are replaced by defaults (see Normalize).</summary>
public sealed record AppSettings(bool SaveHistory = true, int HistoryRetentionDays = 365, int LiveRefreshSeconds = 2, bool WelcomeDismissed = false)
{
    public static readonly int[] RetentionOptions = { 30, 90, 365, 0 }; // 0 = keep everything
    public static readonly int[] RefreshOptions = { 1, 2, 5 };

    public AppSettings Normalize() => this with
    {
        HistoryRetentionDays = RetentionOptions.Contains(HistoryRetentionDays) ? HistoryRetentionDays : 365,
        LiveRefreshSeconds = RefreshOptions.Contains(LiveRefreshSeconds) ? LiveRefreshSeconds : 2
    };
}
