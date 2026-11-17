namespace OPTIVEX.Core.Models;

/// <summary>
/// One reading that may legitimately be unavailable. When Value is null, Reason explains why.
/// This is how OPTIVEX avoids fabricating sensor data.
/// </summary>
public readonly record struct SensorReading(double? Value, string? Reason)
{
    public static SensorReading Ok(double value) => new(value, null);
    public static SensorReading Unavailable(string reason) => new(null, reason);
    public bool IsAvailable => Value.HasValue;
}

/// <param name="TotalCpuPercent">Whole-system CPU utilisation (all processes).</param>
/// <param name="AppCpuPercent">CPU used by OPTIVEX itself, as % of total machine capacity.</param>
public sealed record LiveMetrics(
    DateTime Timestamp,
    SensorReading TotalCpuPercent,
    double AppCpuPercent,
    double? MemoryUsedGb,
    double? MemoryTotalGb,
    int? ProcessCount,
    TimeSpan Uptime,
    SensorReading CpuTempC,
    SensorReading GpuTempC,
    SensorReading GpuLoadPercent)
{
    public double? MemoryPercent =>
        MemoryUsedGb is double used && MemoryTotalGb is double total && total > 0 ? used / total * 100 : null;
}
