namespace OPTIVEX.Core.Health;

public static class CpuUsageCalculator
{
    /// <summary>
    /// A process's CPU use as a percentage of TOTAL machine capacity (all logical processors),
    /// the same basis as Task Manager's per-process column.
    /// </summary>
    public static double ProcessPercent(TimeSpan previousCpu, TimeSpan currentCpu, TimeSpan wallElapsed, int logicalProcessors)
    {
        if (wallElapsed <= TimeSpan.Zero || logicalProcessors <= 0) return 0;
        var delta = (currentCpu - previousCpu).TotalSeconds;
        if (delta <= 0) return 0;
        var pct = delta / (wallElapsed.TotalSeconds * logicalProcessors) * 100;
        return Math.Clamp(pct, 0, 100);
    }
}
