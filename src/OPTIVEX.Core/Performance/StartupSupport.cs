using System.Text.RegularExpressions;

namespace OPTIVEX.Core.Performance;

/// <summary>Encoding of the per-user StartupApproved values Windows (and Task Manager) use to disable startup items.</summary>
public static class StartupApprovedCodec
{
    /// <summary>Missing or empty data means "enabled". Otherwise an odd first byte (3, 7…) means disabled; 2 and 6 mean enabled.</summary>
    public static bool IsEnabled(byte[]? data) => data is null || data.Length == 0 || (data[0] & 0x01) == 0;

    public static byte[] BuildEnabled()
    {
        var b = new byte[12];
        b[0] = 0x02;
        return b;
    }

    public static byte[] BuildDisabled(DateTime utcNow)
    {
        var b = new byte[12];
        b[0] = 0x03;
        BitConverter.GetBytes(utcNow.ToFileTimeUtc()).CopyTo(b, 4);
        return b;
    }
}

public static class StartupSafety
{
    /// <summary>Security components (Windows Security / Defender) are never offered for disabling.</summary>
    public static bool IsProtected(string name, string command)
    {
        string[] markers = { "SecurityHealth", "Windows Defender", "WindowsDefender", "Microsoft Defender", "MsMpEng" };
        return markers.Any(m => name.Contains(m, StringComparison.OrdinalIgnoreCase) ||
                                command.Contains(m, StringComparison.OrdinalIgnoreCase));
    }
}

public static class CommandLine
{
    /// <summary>Best-effort executable path from a Run-key command line (handles quotes and unquoted paths with spaces).</summary>
    public static string? ExtractExecutable(string? command)
    {
        if (string.IsNullOrWhiteSpace(command)) return null;
        var s = command.Trim();
        if (s[0] == '"')
        {
            var end = s.IndexOf('"', 1);
            return end > 1 ? s[1..end] : null;
        }
        var exe = s.IndexOf(".exe", StringComparison.OrdinalIgnoreCase);
        if (exe >= 0) return s[..(exe + 4)];
        var space = s.IndexOf(' ');
        return space > 0 ? s[..space] : s;
    }
}

public static class PowerCfgParser
{
    private static readonly Regex Scheme = new(@"Power Scheme GUID:\s*([0-9a-fA-F\-]{36})\s*(?:\((.*)\))?", RegexOptions.Compiled);

    public static (Guid Id, string? Name)? ParseActiveScheme(string? output)
    {
        if (string.IsNullOrWhiteSpace(output)) return null;
        var m = Scheme.Match(output);
        if (!m.Success || !Guid.TryParse(m.Groups[1].Value, out var id)) return null;
        var name = m.Groups[2].Success ? m.Groups[2].Value.Trim() : null;
        return (id, string.IsNullOrEmpty(name) ? null : name);
    }
}

public static class PowerAdvice
{
    public static readonly Guid Balanced = new("381b4222-f694-41f0-9685-ff5bb260df2e");
    public static readonly Guid HighPerformance = new("8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c");
    public static readonly Guid PowerSaver = new("a1841308-3541-4fab-bc81-f71556f20b4e");

    public static string ForPlan(Models.PowerPlanInfo info)
    {
        if (info.Id is not Guid id) return $"Could not read the active power plan ({info.Error ?? "unknown reason"}).";
        if (id == PowerSaver)
            return "Power saver limits CPU speed to save energy. If the PC feels sluggish while plugged in, switching to Balanced is a low-risk, reversible change (Settings → System → Power & battery).";
        if (id == HighPerformance)
            return info.IsLaptop == true
                ? "High performance keeps components at higher speeds, which drains a laptop battery faster and can raise temperatures. Balanced is usually enough unless you are gaming while plugged in."
                : "High performance is reasonable on a desktop; the cost is higher idle power use.";
        if (id == Balanced)
            return "Balanced adapts to load and suits most uses. No change recommended.";
        return $"This is a custom or manufacturer plan ('{info.Name ?? id.ToString()}'). OPTIVEX cannot judge it, so no change is recommended.";
    }

    public static string ForVisualEffects(Models.VisualEffectsInfo v) => v.Setting switch
    {
        2 => "Windows is already set to 'Adjust for best performance'.",
        1 => "Set to 'best appearance' (all animations and effects on). On PCs with little RAM or an older GPU, 'Adjust for best performance' can feel snappier. It is optional and reversible: System Properties → Advanced → Performance Settings.",
        3 => "Custom visual-effects settings are in use. No change recommended.",
        _ => "Windows chooses visual effects automatically for your hardware. No change recommended."
    };
}
