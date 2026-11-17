namespace OPTIVEX.Core.Models;

/// <param name="TotalRamGb">0 when the value could not be read.</param>
/// <param name="UsedRamGb">null when available memory could not be read (never guessed).</param>
/// <param name="PhysicalCores">null when not reported.</param>
public sealed record SystemSnapshot(
    string ComputerName, string WindowsVersion, string CpuName, int LogicalProcessors,
    string GpuName, double TotalRamGb, double? UsedRamGb, IReadOnlyList<DriveSnapshot> Drives,
    int? PhysicalCores = null, string? Motherboard = null, string? Architecture = null);

public sealed record DriveSnapshot(string Name, double TotalGb, double FreeGb)
{
    public double UsedGb => Math.Max(0, TotalGb - FreeGb);
    public double UsedPercent => TotalGb <= 0 ? 0 : UsedGb / TotalGb * 100;
}
