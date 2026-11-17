namespace OPTIVEX.Core.Models;

public enum BatteryState { Unknown, Charging, Discharging, PluggedInNotCharging }

/// <summary>Battery facts as Windows reports them. Every optional value is a SensorReading so a missing value carries its reason.</summary>
public sealed record BatteryInfo(
    bool Present, string? NotPresentReason, string? Name, string? Chemistry,
    SensorReading DesignCapacityWh, SensorReading FullChargeCapacityWh, SensorReading ChargePercent,
    BatteryState State, SensorReading CycleCount, SensorReading RuntimeMinutes)
{
    public static BatteryInfo None(string reason)
    {
        var na = SensorReading.Unavailable(reason);
        return new(false, reason, null, null, na, na, na, BatteryState.Unknown, na, na);
    }
}

public enum RecommendationCategory { Memory, Storage, Startup, Processes, Thermal, Battery, Power, Visuals }
public enum RecommendationPriority { High, Medium, Low }
public enum RiskLevel { Low, Medium, High }
public enum Reversibility { Yes, No, NotApplicable }

/// <summary>The six fields the product spec requires for every recommendation.</summary>
public sealed record Recommendation(
    RecommendationCategory Category, RecommendationPriority Priority,
    string Issue, string Explanation, string PotentialBenefit,
    RiskLevel Risk, string RecommendedAction, Reversibility Reversible);

public sealed record RecommendationReport(IReadOnlyList<Recommendation> Items, IReadOnlyList<string> NotAssessed, DateTime GeneratedAt);

/// <summary>Everything the engine may look at. A null member means "could not be read" and is reported, never assumed.</summary>
public sealed record SystemContext(
    SystemSnapshot? Snapshot, LiveMetrics? Live, IReadOnlyList<ProcessGroup>? Processes,
    IReadOnlyList<StartupEntry>? Startup, PowerPlanInfo? Plan, VisualEffectsInfo? Visuals, BatteryInfo? Battery,
    IReadOnlyList<string> CollectionNotes);
