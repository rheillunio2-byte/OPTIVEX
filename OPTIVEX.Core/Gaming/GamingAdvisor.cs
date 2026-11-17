using OPTIVEX.Core.Models;
using OPTIVEX.Core.Performance;

namespace OPTIVEX.Core.Gaming;

/// <summary>Hardware-based gaming notes. Every tip is triggered by something actually measured on this PC.</summary>
public static class GamingAdvisor
{
    public static IReadOnlyList<PerformanceObservation> Advise(HardwareProfile hw, PowerPlanInfo? plan, double? cpuTempC, double? gpuTempC)
    {
        var tips = new List<PerformanceObservation>();

        if (hw.RamGb > 0 && hw.RamGb < 7.2)
            tips.Add(new(ObservationSeverity.Warning, $"Only {hw.RamGb:0.#} GB of RAM detected",
                "Games often list 8 GB or more as a minimum. Check the published requirements on the Game Compatibility page, and close background programs before playing."));

        if (hw.GpuKind == GpuKind.IntegratedOnly)
            tips.Add(new(ObservationSeverity.Info, "Integrated graphics detected",
                "Your graphics appear to share system memory. Expect to lower graphics settings, and note that some games publish a higher RAM figure for integrated graphics (Minecraft: Java Edition lists 12 GB instead of 8 GB)."));

        if (hw.GpuKind == GpuKind.Hybrid)
            tips.Add(new(ObservationSeverity.Info, "Two graphics adapters detected",
                "On PCs with both integrated and dedicated graphics, Windows may run a game on the integrated one. In Settings → System → Display → Graphics you can set the game to use the High performance GPU."));

        if (hw.FreeStorageGb > 0 && hw.FreeStorageGb < 50)
            tips.Add(new(ObservationSeverity.Warning, $"Only {hw.FreeStorageGb:0} GB free on {hw.FreeStorageDrive}",
                "Large games can need 100 GB or more (Baldur's Gate 3 lists 150 GB). Free up space or use another drive before installing."));

        if (plan?.Id == PowerAdvice.PowerSaver)
            tips.Add(new(ObservationSeverity.Warning, "Power saver plan is active",
                "Power saver limits CPU speed. For gaming, Balanced is a safer choice, and High performance is an option while plugged in. Changing the plan is reversible."));

        foreach (var (label, t) in new[] { ("CPU", cpuTempC), ("GPU", gpuTempC) })
            if (t >= 85)
                tips.Add(new(ObservationSeverity.Warning, $"{label} temperature reads {t:0}°C right now",
                    "Safe limits depend on the specific chip. If this stays high, check for dust, blocked vents or a stopped fan."));

        if (tips.Count == 0)
            tips.Add(new(ObservationSeverity.Info, "Nothing stands out in your hardware readings",
                "Check a specific game on the Game Compatibility page to compare it with its published requirements."));
        return tips;
    }
}
