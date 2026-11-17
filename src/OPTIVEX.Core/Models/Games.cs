using System.Text.Json.Serialization;

namespace OPTIVEX.Core.Models;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SourceKind { Official, Secondary, UserProvided }

/// <param name="RamGbIntegratedGpu">Some games publish a higher RAM figure for integrated graphics.</param>
public sealed record RequirementTier(string? Cpu, string? Gpu, int? RamGb, string? Os, int? RamGbIntegratedGpu = null)
{
    [JsonIgnore] public bool HasAnyData => Cpu is not null || Gpu is not null || RamGb is not null || Os is not null;
}

public sealed record GameRequirement(
    string Id, string Title, RequirementTier Minimum, RequirementTier Recommended, int? StorageGb,
    SourceKind SourceKind, string Source, DateOnly? LastVerified, string? Notes = null)
{
    [JsonIgnore] public bool IsUserProvided => SourceKind == SourceKind.UserProvided;
    [JsonIgnore] public string OriginLabel => SourceKind switch
    {
        SourceKind.Official => "Official",
        SourceKind.Secondary => "Secondary source",
        _ => "User-provided"
    };
}

public sealed record GameProfile(string Id, string Name, string? ExePath, string? Notes);

public enum ManualLevel { NotSure, BelowMinimum, MeetsMinimum, MeetsRecommended }
public sealed record ManualAssessment(ManualLevel Cpu, ManualLevel Gpu);

public enum GpuKind { Unknown, IntegratedOnly, Discrete, Hybrid }

public sealed record HardwareProfile(
    string Cpu, string Gpu, double RamGb, double FreeStorageGb, string? FreeStorageDrive,
    int? WindowsBuild, bool? Is64BitOs, GpuKind GpuKind);
