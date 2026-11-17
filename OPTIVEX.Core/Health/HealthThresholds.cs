namespace OPTIVEX.Core.Health;

public enum HealthLevel { Unknown, Normal, Elevated, High }
public enum MetricKind { CpuUsage, MemoryUsage, Temperature, DiskUsage }

/// <summary>
/// OPTIVEX display heuristics for colouring readings. These are NOT vendor limits:
/// a CPU's real safe temperature depends on its model, and brief CPU spikes are normal.
/// </summary>
public static class HealthThresholds
{
    public static HealthLevel Classify(MetricKind kind, double? value)
    {
        if (value is not double v || double.IsNaN(v)) return HealthLevel.Unknown;
        var (elevated, high) = kind switch
        {
            MetricKind.CpuUsage => (70.0, 90.0),
            MetricKind.MemoryUsage => (75.0, 90.0),
            MetricKind.Temperature => (75.0, 85.0),
            MetricKind.DiskUsage => (80.0, 90.0),
            _ => (double.MaxValue, double.MaxValue)
        };
        return v >= high ? HealthLevel.High : v >= elevated ? HealthLevel.Elevated : HealthLevel.Normal;
    }
}
