using OPTIVEX.Core.Models;

namespace OPTIVEX.Core.Performance;

public static class ProcessAggregator
{
    // Windows and security components. OPTIVEX offers no terminate action at all; this flag only
    // tells the user why a process should not be interfered with.
    private static readonly HashSet<string> Protected = new(StringComparer.OrdinalIgnoreCase)
    {
        "system", "registry", "smss", "csrss", "wininit", "winlogon", "services", "lsass", "svchost",
        "dwm", "fontdrvhost", "explorer", "memory compression", "msmpeng", "nissrv", "securityhealthservice", "sihost"
    };

    public static bool IsProtected(string name) => Protected.Contains(name);

    public static IReadOnlyList<ProcessGroup> Group(IEnumerable<ProcessSample> samples) =>
        samples
            .Where(s => !s.Name.Equals("Idle", StringComparison.OrdinalIgnoreCase) &&
                        !s.Name.Equals("System Idle Process", StringComparison.OrdinalIgnoreCase))
            .GroupBy(s => s.Name, StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var known = g.Where(s => s.CpuPercent.HasValue).ToList();
                double? cpu = known.Count == 0 ? null : known.Sum(s => s.CpuPercent!.Value);
                return new ProcessGroup(g.Key, g.Count(), cpu, g.Sum(s => s.WorkingSetBytes), IsProtected(g.Key));
            })
            .ToList();
}
