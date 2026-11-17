using System.Text.RegularExpressions;
using OPTIVEX.Core.Models;

namespace OPTIVEX.Core.Gaming;

/// <summary>Heuristic only: decides from adapter names whether graphics look integrated or discrete.</summary>
public static class GpuClassifier
{
    private static readonly Regex AmdApuName = new(@"Radeon.*Graphics\s*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static bool IsIntegrated(string name)
    {
        if (name.Contains("NVIDIA", StringComparison.OrdinalIgnoreCase) || name.Contains("GeForce", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Quadro", StringComparison.OrdinalIgnoreCase)) return false;
        if (name.Contains("Intel", StringComparison.OrdinalIgnoreCase)) return !name.Contains("Arc", StringComparison.OrdinalIgnoreCase);
        if (AmdApuName.IsMatch(name)) return !name.Contains(" RX ", StringComparison.OrdinalIgnoreCase) && !name.Contains("Pro", StringComparison.OrdinalIgnoreCase);
        return false;
    }

    /// <param name="adapterNames">Names joined with " / ", as produced by the hardware scanner.</param>
    public static GpuKind Classify(string? adapterNames)
    {
        if (string.IsNullOrWhiteSpace(adapterNames)) return GpuKind.Unknown;
        int integrated = 0, discrete = 0;
        foreach (var raw in adapterNames.Split(" / ", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (raw.Equals("Unavailable", StringComparison.OrdinalIgnoreCase) ||
                raw.Contains("Microsoft", StringComparison.OrdinalIgnoreCase) ||
                raw.Contains("Virtual", StringComparison.OrdinalIgnoreCase)) continue;
            if (IsIntegrated(raw)) integrated++; else discrete++;
        }
        if (integrated > 0 && discrete > 0) return GpuKind.Hybrid;
        if (discrete > 0) return GpuKind.Discrete;
        return integrated > 0 ? GpuKind.IntegratedOnly : GpuKind.Unknown;
    }
}

public sealed record OsRequirement(bool Requires64Bit, int? MinWindowsMajor);

public static class OsRequirementParser
{
    private static readonly Regex WindowsVersion = new(@"Windows\s*(\d{1,2})", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Null when the text says nothing checkable.</summary>
    public static OsRequirement? Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        bool is64 = text.Contains("64-bit", StringComparison.OrdinalIgnoreCase) || text.Contains("64 bit", StringComparison.OrdinalIgnoreCase);
        var m = WindowsVersion.Match(text);
        int? major = m.Success && int.TryParse(m.Groups[1].Value, out var v) ? v : null;
        return is64 || major is not null ? new OsRequirement(is64, major) : null;
    }

    /// <summary>Build 22000 and above is Windows 11; 10240 and above is Windows 10; lower returns 0 (older).</summary>
    public static int? WindowsMajorFromBuild(int? build) =>
        build is null ? null : build >= 22000 ? 11 : build >= 10240 ? 10 : 0;
}

public static class HardwareProfileBuilder
{
    private static readonly Regex Build = new(@"build\s+(\d+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static HardwareProfile From(SystemSnapshot s)
    {
        var best = s.Drives.OrderByDescending(d => d.FreeGb).FirstOrDefault();
        var m = Build.Match(s.WindowsVersion ?? "");
        int? build = m.Success && int.TryParse(m.Groups[1].Value, out var b) ? b : null;
        bool? is64 = s.Architecture switch
        {
            "X64" or "Arm64" => true,
            "X86" or "Arm" => false,
            _ => null
        };
        return new HardwareProfile(s.CpuName, s.GpuName, s.TotalRamGb, best?.FreeGb ?? 0, best?.Name, build, is64, GpuClassifier.Classify(s.GpuName));
    }
}
