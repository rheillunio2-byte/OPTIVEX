using OPTIVEX.Core.Gaming;
using OPTIVEX.Core.Models;

namespace OPTIVEX.Core.Services;

public static class Verdicts
{
    public static string Label(CompatibilityVerdict v) => v switch
    {
        CompatibilityVerdict.MeetsRecommended => "Meets Recommended Requirements",
        CompatibilityVerdict.MeetsMinimum => "Meets Minimum Requirements",
        CompatibilityVerdict.BelowMinimum => "Below Minimum Requirements",
        _ => "Insufficient Information"
    };
}

/// <summary>
/// Compares detected hardware with a game's PUBLISHED requirements.
/// RAM, free storage and OS (64-bit / Windows version) are checked automatically. CPU and GPU model names
/// do not establish benchmark equivalence, so those two use the user's own assessment and are never
/// guessed. Compatibility is not performance: no FPS or quality level is ever predicted.
/// </summary>
public sealed class CompatibilityService
{
    /// Windows reports slightly less than the installed amount (e.g. ~7.7 GB on an 8 GB machine).
    public const double RamTolerance = 0.90;

    public CompatibilityResult Compare(GameRequirement game, HardwareProfile hw, ManualAssessment manual)
    {
        var checks = new List<ComponentCheck>();
        bool integrated = hw.GpuKind == GpuKind.IntegratedOnly;

        // ---- RAM
        int? minRam = RamFor(game.Minimum, integrated);
        int? recRam = RamFor(game.Recommended, integrated);
        bool? recRamPass = recRam is int rr ? hw.RamGb >= rr * RamTolerance : null;
        if (minRam is int mr)
        {
            bool ok = hw.RamGb >= mr * RamTolerance;
            string extra = integrated && game.Minimum.RamGbIntegratedGpu is not null ? " (the figure for integrated graphics, which your PC appears to use)" : "";
            checks.Add(new("RAM", ok ? CheckStatus.Pass : CheckStatus.Fail,
                $"{hw.RamGb:0.#} GB detected (as reported by Windows); minimum {mr} GB{extra}" +
                (recRam is int r2 ? $", recommended {r2} GB." : ".")));
        }
        else checks.Add(new("RAM", CheckStatus.NotPublished, "The source does not publish a minimum RAM figure."));

        // ---- Storage
        if (game.StorageGb is int sg)
        {
            bool ok = hw.FreeStorageGb >= sg;
            checks.Add(new("Free storage", ok ? CheckStatus.Pass : CheckStatus.Fail,
                $"{hw.FreeStorageGb:0.#} GB free on {hw.FreeStorageDrive ?? "your fixed drive with the most space"}; {sg} GB required. " +
                "It must be free on the drive you install to."));
        }
        else checks.Add(new("Free storage", CheckStatus.NotPublished, "The source does not publish a storage requirement."));

        // ---- OS
        var os = OsRequirementParser.Parse(game.Minimum.Os);
        if (os is null)
            checks.Add(new("Windows", CheckStatus.NotPublished, "The source does not publish a checkable OS requirement."));
        else
        {
            int? major = OsRequirementParser.WindowsMajorFromBuild(hw.WindowsBuild);
            bool unknown = (os.Requires64Bit && hw.Is64BitOs is null) || (os.MinWindowsMajor is not null && major is null);
            bool ok = (!os.Requires64Bit || hw.Is64BitOs == true) && (os.MinWindowsMajor is null || major >= os.MinWindowsMajor);
            checks.Add(new("Windows", unknown ? CheckStatus.Unverified : ok ? CheckStatus.Pass : CheckStatus.Fail,
                $"Required: {game.Minimum.Os}. Detected: {(major is 0 ? "an older Windows" : major is int mj ? $"Windows {mj}" : "unknown version")}, " +
                $"{(hw.Is64BitOs == true ? "64-bit" : hw.Is64BitOs == false ? "32-bit" : "unknown architecture")}."));
        }

        // ---- CPU / GPU (user's own assessment)
        checks.Add(Manual("CPU", game.Minimum.Cpu, game.Recommended.Cpu, hw.Cpu, manual.Cpu));
        checks.Add(Manual("GPU", game.Minimum.Gpu, game.Recommended.Gpu, hw.Gpu, manual.Gpu));

        // ---- Verdict
        CompatibilityVerdict verdict;
        if (checks.Any(c => c.Status == CheckStatus.Fail)) verdict = CompatibilityVerdict.BelowMinimum;
        else if (checks.Any(c => c.Status == CheckStatus.Unverified)) verdict = CompatibilityVerdict.InsufficientInformation;
        else if (!checks.Any(c => c.Status == CheckStatus.Pass)) verdict = CompatibilityVerdict.InsufficientInformation;
        else
        {
            // Recommended is claimed only when every PUBLISHED recommended item is met and at least one exists.
            bool anyRec = recRam is not null || game.Recommended.Cpu is not null || game.Recommended.Gpu is not null;
            bool recMet = anyRec
                && (recRam is null || recRamPass == true)
                && (game.Recommended.Cpu is null || manual.Cpu == ManualLevel.MeetsRecommended)
                && (game.Recommended.Gpu is null || manual.Gpu == ManualLevel.MeetsRecommended);
            verdict = recMet ? CompatibilityVerdict.MeetsRecommended : CompatibilityVerdict.MeetsMinimum;
        }

        var limitations = new List<string>
        {
            "Hardware compatibility is not performance. No FPS, resolution or stability is predicted.",
            "Published requirements are the developer's targets, not guarantees. They can change when a game is updated."
        };
        if (manual.Cpu != ManualLevel.NotSure || manual.Gpu != ManualLevel.NotSure)
            limitations.Add("Your CPU/GPU result is based on your own assessment. OPTIVEX cannot compare processor or graphics models automatically.");
        if (game.IsUserProvided)
            limitations.Add("These requirements were entered by a user and have not been verified by OPTIVEX.");
        return new CompatibilityResult(verdict, checks, limitations);
    }

    private static int? RamFor(RequirementTier tier, bool integrated) =>
        integrated && tier.RamGbIntegratedGpu is int i ? i : tier.RamGb;

    private static ComponentCheck Manual(string name, string? min, string? rec, string detected, ManualLevel level)
    {
        if (min is null)
            return new(name, CheckStatus.NotPublished, $"The source does not publish a minimum {name}.");
        string facts = $"Detected: {(string.IsNullOrWhiteSpace(detected) ? "unavailable" : detected)}. Minimum listed: {min}." +
                       (rec is null ? "" : $" Recommended listed: {rec}.");
        return level switch
        {
            ManualLevel.NotSure => new(name, CheckStatus.Unverified, facts + " Compare these and tell OPTIVEX your assessment below."),
            ManualLevel.BelowMinimum => new(name, CheckStatus.Fail, facts + " You assessed it as below the minimum."),
            ManualLevel.MeetsMinimum => new(name, CheckStatus.Pass, facts + " You assessed it as meeting the minimum."),
            _ => new(name, CheckStatus.Pass, facts + " You assessed it as meeting the recommended level.")
        };
    }
}
