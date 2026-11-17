namespace OPTIVEX.Core.Models;

/// <summary>NotPublished = the source gives no figure for this component (informational, never a failure).</summary>
public enum CheckStatus { Pass, Fail, Unverified, NotPublished }

public enum CompatibilityVerdict { MeetsRecommended, MeetsMinimum, BelowMinimum, InsufficientInformation }

public sealed record ComponentCheck(string Component, CheckStatus Status, string Detail);

public sealed record CompatibilityResult(
    CompatibilityVerdict Verdict, IReadOnlyList<ComponentCheck> Checks, IReadOnlyList<string> Limitations);
