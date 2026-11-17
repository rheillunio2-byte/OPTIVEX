using OPTIVEX.Core.Models;

namespace OPTIVEX.Core.Health;

public sealed record BatteryAssessment(bool Reliable, double? HealthPercent, double? WearPercent, string? Reason);

public static class BatteryHealth
{
    /// <summary>
    /// Health = full-charge capacity as a share of design capacity. Only reported when both values exist and are
    /// plausible; otherwise Reliable is false and Reason says why. Values come from Windows and can be imperfect.
    /// </summary>
    public static BatteryAssessment Assess(SensorReading design, SensorReading full)
    {
        if (design.Value is not double d) return new(false, null, null, design.Reason ?? "Design capacity is not reported.");
        if (full.Value is not double f) return new(false, null, null, full.Reason ?? "Full-charge capacity is not reported.");
        if (d <= 0 || f <= 0) return new(false, null, null, "Windows reported a zero capacity value.");
        if (f > d * 1.5) return new(false, null, null, "Full-charge capacity is far above design capacity, so the battery's reported values look inconsistent.");
        double health = Math.Min(100, f / d * 100);
        return new(true, health, 100 - health, null);
    }

    /// <summary>OPTIVEX display heuristic, not a manufacturer limit.</summary>
    public static HealthLevel Level(double? healthPercent) => healthPercent switch
    {
        null => HealthLevel.Unknown,
        >= 80 => HealthLevel.Normal,
        >= 60 => HealthLevel.Elevated,
        _ => HealthLevel.High
    };
}

public static class BatteryStateMapper
{
    /// <summary>Win32_Battery.BatteryStatus codes: 1,4,5 on battery; 6-9 charging; 2,3,11 on AC.</summary>
    public static BatteryState FromWin32(int? status) => status switch
    {
        1 or 4 or 5 => BatteryState.Discharging,
        6 or 7 or 8 or 9 => BatteryState.Charging,
        2 or 3 or 11 => BatteryState.PluggedInNotCharging,
        _ => BatteryState.Unknown
    };

    public static string Describe(BatteryState s) => s switch
    {
        BatteryState.Charging => "Charging",
        BatteryState.Discharging => "On battery",
        BatteryState.PluggedInNotCharging => "Plugged in, not charging",
        _ => "State unknown"
    };
}
