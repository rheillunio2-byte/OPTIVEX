using OPTIVEX.Core.Gaming;
using OPTIVEX.Core.Health;
using OPTIVEX.Core.Models;
using OPTIVEX.Core.Performance;

namespace OPTIVEX.Core.Intelligence;

/// <summary>
/// Optimization Intelligence. Every recommendation is triggered by a value actually measured on this PC and
/// quotes it. Anything that could not be read is listed in NotAssessed instead of being guessed. OPTIVEX only
/// advises: no recommendation is applied automatically. Thresholds are display heuristics, not vendor limits.
/// </summary>
public static class RecommendationEngine
{
    public const double HighMemoryPercent = 85, CriticalMemoryPercent = 92;
    public const double DriveFullPercent = 90, DriveCriticalPercent = 95, DriveLowFreeGb = 10;
    public const double HeavyCpuPercent = 25, HeavyMemoryShare = 25;
    public const double WarmTempC = 85, HotTempC = 90;
    public const int ManyStartup = 10, VeryManyStartup = 15;

    public static RecommendationReport Analyze(SystemContext ctx, IReadOnlySet<RecommendationCategory>? only = null, DateTime? now = null)
    {
        var items = new List<Recommendation>();
        var notes = new List<(RecommendationCategory Category, string Text)>();
        bool Want(RecommendationCategory c) => only is null || only.Contains(c);

        if (Want(RecommendationCategory.Memory)) Memory(ctx, items, notes);
        if (Want(RecommendationCategory.Storage)) Storage(ctx, items, notes);
        if (Want(RecommendationCategory.Startup)) Startup(ctx, items, notes);
        if (Want(RecommendationCategory.Processes)) Processes(ctx, items, notes);
        if (Want(RecommendationCategory.Thermal)) Thermal(ctx, items, notes);
        if (Want(RecommendationCategory.Battery)) Battery(ctx, items, notes);
        if (Want(RecommendationCategory.Power)) Power(ctx, items, notes);
        if (Want(RecommendationCategory.Visuals)) Visuals(ctx, items);

        return new RecommendationReport(
            items.OrderBy(i => i.Priority).ThenBy(i => i.Category).ToList(),
            notes.Select(n => n.Text).Distinct().ToList(),
            now ?? DateTime.Now);
    }

    private static bool IsOptivex(string name) => name.StartsWith("OPTIVEX", StringComparison.OrdinalIgnoreCase);

    private static ProcessGroup? TopMemory(SystemContext c) =>
        c.Processes?.Where(g => !g.IsProtected && !IsOptivex(g.Name)).OrderByDescending(g => g.WorkingSetBytes).FirstOrDefault();

    // ---------------------------------------------------------------- memory
    private static void Memory(SystemContext c, List<Recommendation> items, List<(RecommendationCategory, string)> notes)
    {
        if (c.Live is null) notes.Add((RecommendationCategory.Memory, "Memory pressure: live sampling failed."));
        else if (c.Live.MemoryPercent is double pct)
        {
            if (pct >= HighMemoryPercent)
            {
                var top = TopMemory(c);
                items.Add(new(RecommendationCategory.Memory, pct >= CriticalMemoryPercent ? RecommendationPriority.High : RecommendationPriority.Medium,
                    $"Memory is {pct:0}% in use ({(c.Live.MemoryTotalGb - c.Live.MemoryUsedGb):0.0} GB available)",
                    top is null ? "When memory runs short Windows swaps data to disk, which slows everything down."
                                : $"When memory runs short Windows swaps data to disk, which slows everything down. The largest user right now is {top.Name} ({top.WorkingSetMb:N0} MB across {top.Instances} process(es)).",
                    "Frees memory and reduces slowdowns caused by swapping.",
                    RiskLevel.Low, "Close programs and browser tabs you are not using. OPTIVEX does not close them for you.", Reversibility.Yes));
            }
        }
        else notes.Add((RecommendationCategory.Memory, "Memory pressure: Windows did not report memory status."));

        if (c.Snapshot is { TotalRamGb: > 0 and < 7.2 } s)
            items.Add(new(RecommendationCategory.Memory, RecommendationPriority.Low,
                $"Only {s.TotalRamGb:0.#} GB of RAM is installed",
                "Many current programs and games list 8 GB or more as a minimum, so there is little headroom with several programs open.",
                "Keeping fewer programs open and fewer startup items avoids running out of memory.",
                RiskLevel.Low, "Keep startup programs minimal. If your PC allows it, adding memory is the lasting fix.", Reversibility.NotApplicable));
    }

    // ---------------------------------------------------------------- storage
    private static void Storage(SystemContext c, List<Recommendation> items, List<(RecommendationCategory, string)> notes)
    {
        if (c.Snapshot is null) { notes.Add((RecommendationCategory.Storage, "Disk space: the hardware scan failed.")); return; }
        foreach (var d in c.Snapshot.Drives.Where(d => d.TotalGb > 0))
        {
            if (d.UsedPercent < DriveFullPercent && d.FreeGb >= DriveLowFreeGb) continue;
            items.Add(new(RecommendationCategory.Storage,
                d.UsedPercent >= DriveCriticalPercent || d.FreeGb < 5 ? RecommendationPriority.High : RecommendationPriority.Medium,
                $"Drive {d.Name} is {d.UsedPercent:0}% full ({d.FreeGb:0.#} GB free)",
                "Windows needs free space for updates, temporary files and swapping. Very full drives tend to slow down and can make updates fail.",
                "More free space helps updates and everyday responsiveness.",
                RiskLevel.Low,
                "Use Storage Cleaner (you review a preview and confirm) and the Large-file analyzer to find files you no longer need. Cleaner deletions are permanent.",
                Reversibility.No));
        }
    }

    // ---------------------------------------------------------------- startup
    private static void Startup(SystemContext c, List<Recommendation> items, List<(RecommendationCategory, string)> notes)
    {
        if (c.Startup is null) { notes.Add((RecommendationCategory.Startup, "Startup programs could not be read.")); return; }
        var enabled = c.Startup.Where(e => e.IsEnabled).ToList();
        if (enabled.Count < ManyStartup) return;
        var names = string.Join(", ", enabled.Where(e => !e.IsProtected).Select(e => e.Name).Take(5));
        items.Add(new(RecommendationCategory.Startup, enabled.Count >= VeryManyStartup ? RecommendationPriority.Medium : RecommendationPriority.Low,
            $"{enabled.Count} programs are set to start with Windows",
            $"Each one can lengthen sign-in time and use memory in the background. Examples: {names}.",
            "May shorten sign-in time and free some memory. The amount varies, and OPTIVEX does not measure per-program startup cost.",
            RiskLevel.Low, "Open Performance → Startup apps and disable only programs you recognise and do not need at sign-in.", Reversibility.Yes));
    }

    // ---------------------------------------------------------------- processes
    private static void Processes(SystemContext c, List<Recommendation> items, List<(RecommendationCategory, string)> notes)
    {
        if (c.Processes is null) { notes.Add((RecommendationCategory.Processes, "Per-program CPU and memory use could not be read.")); return; }

        foreach (var g in c.Processes.Where(g => g.CpuPercent >= HeavyCpuPercent && !IsOptivex(g.Name)).OrderByDescending(g => g.CpuPercent).Take(2))
        {
            if (g.IsProtected)
                items.Add(new(RecommendationCategory.Processes, RecommendationPriority.Low,
                    $"A Windows component, {g.Name}, is using {g.CpuPercent:0}% of total CPU",
                    "Measured over about two seconds. Windows and security components are often busy temporarily, for example during scans or updates.",
                    "None needed if it settles by itself.",
                    RiskLevel.Low, "Wait and re-check. OPTIVEX does not recommend ending Windows or security components.", Reversibility.NotApplicable));
            else
                items.Add(new(RecommendationCategory.Processes, g.CpuPercent >= 50 ? RecommendationPriority.Medium : RecommendationPriority.Low,
                    $"{g.Name} is using {g.CpuPercent:0}% of total CPU",
                    "Measured over about two seconds, so it may be a short spike. Heavy background use slows other programs and drains a laptop battery faster.",
                    "Closing it if you are not using it frees CPU time.",
                    RiskLevel.Low, "If you are not using it, close it from inside the program. OPTIVEX never ends processes for you.", Reversibility.Yes));
        }

        if (c.Snapshot is { TotalRamGb: > 0 } s && TopMemory(c) is { } top)
        {
            double share = top.WorkingSetMb / 1024d / s.TotalRamGb * 100;
            if (share >= HeavyMemoryShare)
                items.Add(new(RecommendationCategory.Processes, RecommendationPriority.Low,
                    $"{top.Name} holds {top.WorkingSetMb / 1024d:0.0} GB ({share:0}% of your RAM)",
                    $"Spread over {top.Instances} process(es). Some programs keep growing the longer they run.",
                    "Restarting or closing it releases that memory.",
                    RiskLevel.Low, "Save your work, then restart or close it. OPTIVEX does not do this for you.", Reversibility.Yes));
        }
    }

    // ---------------------------------------------------------------- temperature
    private static void Thermal(SystemContext c, List<Recommendation> items, List<(RecommendationCategory, string)> notes)
    {
        if (c.Live is null) { notes.Add((RecommendationCategory.Thermal, "Temperatures: live sampling failed.")); return; }
        foreach (var (label, reading) in new[] { ("CPU", c.Live.CpuTempC), ("GPU", c.Live.GpuTempC) })
        {
            if (reading.Value is not double t)
            {
                notes.Add((RecommendationCategory.Thermal, $"{label} temperature: {reading.Reason ?? "not available"}"));
                continue;
            }
            if (t < WarmTempC) continue;
            items.Add(new(RecommendationCategory.Thermal, t >= HotTempC ? RecommendationPriority.High : RecommendationPriority.Medium,
                $"{label} temperature reads {t:0}°C",
                "Safe limits depend on the specific chip, and short spikes under load are normal. Sustained high readings can cause throttling (lower speed) and wear.",
                "Cooler running keeps performance steady and is gentler on components.",
                RiskLevel.Low, "Check that vents are not blocked or dusty, use the PC on a hard flat surface and reduce load. If it stays hot at idle, have it serviced.",
                Reversibility.NotApplicable));
        }
    }

    // ---------------------------------------------------------------- battery
    private static void Battery(SystemContext c, List<Recommendation> items, List<(RecommendationCategory, string)> notes)
    {
        if (c.Battery is null) { notes.Add((RecommendationCategory.Battery, "Battery: could not be read.")); return; }
        if (!c.Battery.Present) return; // a desktop: nothing to assess and nothing to report

        var a = BatteryHealth.Assess(c.Battery.DesignCapacityWh, c.Battery.FullChargeCapacityWh);
        if (!a.Reliable) { notes.Add((RecommendationCategory.Battery, $"Battery wear: {a.Reason}")); return; }
        if (a.HealthPercent >= 80) return;

        items.Add(new(RecommendationCategory.Battery, a.HealthPercent < 60 ? RecommendationPriority.Medium : RecommendationPriority.Low,
            $"Battery holds about {a.HealthPercent:0}% of its design capacity",
            $"Windows reports a full-charge capacity of {c.Battery.FullChargeCapacityWh.Value:0.0} Wh against {c.Battery.DesignCapacityWh.Value:0.0} Wh when new. All batteries wear with age and heat, and these figures can be imperfect.",
            "Understanding the wear helps you decide whether runtime still meets your needs.",
            RiskLevel.Low, "Create Windows' battery report on the Laptop Care page for history. Consider a replacement if runtime no longer suits you.", Reversibility.NotApplicable));
    }

    // ---------------------------------------------------------------- power plan
    private static void Power(SystemContext c, List<Recommendation> items, List<(RecommendationCategory, string)> notes)
    {
        if (c.Plan?.Id is not Guid id) { notes.Add((RecommendationCategory.Power, "Power plan: " + (c.Plan?.Error ?? "could not be read."))); return; }
        var state = c.Battery is { Present: true } b ? b.State : (BatteryState?)null;
        bool onBattery = state == BatteryState.Discharging;
        bool onAcOrDesktop = state is null || state is BatteryState.Charging or BatteryState.PluggedInNotCharging;

        if (id == PowerAdvice.HighPerformance && onBattery)
            items.Add(new(RecommendationCategory.Power, RecommendationPriority.Low, "High performance power plan is active while on battery",
                "This plan keeps components at higher speeds, which drains the battery faster and can raise temperatures.",
                "Longer battery life when you are not doing heavy work.",
                RiskLevel.Low, "Switch to Balanced in Settings → System → Power & battery. You can switch back at any time.", Reversibility.Yes));
        else if (id == PowerAdvice.PowerSaver && onAcOrDesktop)
            items.Add(new(RecommendationCategory.Power, RecommendationPriority.Low, "Power saver plan is active while plugged in",
                "Power saver limits CPU speed to save energy, which is rarely needed on mains power.",
                "The PC may feel noticeably more responsive.",
                RiskLevel.Low, "Switch to Balanced in Settings → System → Power & battery. You can switch back at any time.", Reversibility.Yes));
    }

    // ---------------------------------------------------------------- visual effects
    private static void Visuals(SystemContext c, List<Recommendation> items)
    {
        if (c.Visuals?.Setting != 1 || c.Snapshot is null) return;
        bool lowRam = c.Snapshot.TotalRamGb is > 0 and < 8;
        bool integrated = GpuClassifier.Classify(c.Snapshot.GpuName) == GpuKind.IntegratedOnly;
        if (!lowRam && !integrated) return;
        items.Add(new(RecommendationCategory.Visuals, RecommendationPriority.Low,
            "Windows is set to 'best appearance' on a modest PC",
            $"All animations and effects are on, and this PC has {(lowRam ? $"{c.Snapshot.TotalRamGb:0.#} GB of RAM" : "integrated graphics")}.",
            "Windows, menus and animations may feel snappier. The effect varies and may be small.",
            RiskLevel.Low, "Optional: System Properties → Advanced → Performance Settings → Adjust for best performance.", Reversibility.Yes));
    }
}
