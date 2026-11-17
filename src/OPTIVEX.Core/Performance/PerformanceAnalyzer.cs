using OPTIVEX.Core.Models;

namespace OPTIVEX.Core.Performance;

/// <summary>
/// Turns one reading into plain-language observations. Deliberately cautious: a single sample can be
/// a brief spike, so wording says "right now". The full recommendation engine arrives in Phase 5.
/// </summary>
public static class PerformanceAnalyzer
{
    public const double HeavyCpuPercent = 25;
    public const double HighMemoryPercent = 85;
    public const int ManyStartupEntries = 10;

    public static IReadOnlyList<PerformanceObservation> Analyze(
        IReadOnlyList<ProcessGroup> groups, double? memoryPercent, int enabledStartupEntries)
    {
        var list = new List<PerformanceObservation>();

        var topCpu = groups.Where(g => g.CpuPercent >= HeavyCpuPercent).OrderByDescending(g => g.CpuPercent).FirstOrDefault();
        if (topCpu is not null)
            list.Add(new(ObservationSeverity.Warning, $"{topCpu.Name} is using {topCpu.CpuPercent:0}% of total CPU right now",
                "A single reading can be a short spike, so check again before acting. If it stays high and you are not using that program, closing it normally from the program itself is the safest fix. OPTIVEX never ends processes for you."));

        if (memoryPercent >= HighMemoryPercent)
        {
            var topMem = groups.OrderByDescending(g => g.WorkingSetBytes).FirstOrDefault();
            list.Add(new(ObservationSeverity.Warning, $"Memory is {memoryPercent:0}% in use",
                topMem is null ? "Closing programs you are not using frees memory."
                : $"The largest user is {topMem.Name} ({topMem.WorkingSetMb:0} MB across {topMem.Instances} process(es)). Closing programs or browser tabs you are not using frees memory."));
        }

        if (enabledStartupEntries >= ManyStartupEntries)
            list.Add(new(ObservationSeverity.Info, $"{enabledStartupEntries} programs are set to start with Windows",
                "Each one can lengthen sign-in time and use memory in the background. OPTIVEX does not measure per-program startup impact, so review the list on the Startup tab and disable only what you recognise and don't need. It is reversible."));

        if (list.Count == 0)
            list.Add(new(ObservationSeverity.Info, "No obvious bottleneck in this reading",
                "CPU, memory and startup count are all within ordinary ranges at the moment. This is a snapshot, not a guarantee."));
        return list;
    }
}
