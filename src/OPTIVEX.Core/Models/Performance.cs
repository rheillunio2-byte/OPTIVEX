namespace OPTIVEX.Core.Models;

public sealed record ProcessSample(int Pid, string Name, double? CpuPercent, long WorkingSetBytes);

/// <summary>All instances of one executable name combined (e.g. every chrome.exe).</summary>
public sealed record ProcessGroup(string Name, int Instances, double? CpuPercent, long WorkingSetBytes, bool IsProtected)
{
    public double WorkingSetMb => WorkingSetBytes / 1048576d;
}

public sealed record ProcessSnapshot(IReadOnlyList<ProcessGroup> Groups, int ProcessCount, double? MemoryPercent, bool HasCpuBaseline);

public enum ObservationSeverity { Info, Warning }
public sealed record PerformanceObservation(ObservationSeverity Severity, string Title, string Detail);

public enum StartupSource { CurrentUserRun, MachineRun, MachineRun32, StartupFolder, CommonStartupFolder }

public sealed record StartupEntry(string Name, string Command, StartupSource Source, string? Publisher, bool IsEnabled, bool IsProtected)
{
    public string SourceLabel => Source switch
    {
        StartupSource.CurrentUserRun => "Registry (this user)",
        StartupSource.MachineRun => "Registry (all users)",
        StartupSource.MachineRun32 => "Registry (all users, 32-bit)",
        StartupSource.StartupFolder => "Startup folder (this user)",
        StartupSource.CommonStartupFolder => "Startup folder (all users)",
        _ => "Unknown"
    };
}

/// <param name="Setting">VisualFXSetting: 0 = let Windows choose, 1 = best appearance, 2 = best performance, 3 = custom; null = not set.</param>
public sealed record VisualEffectsInfo(int? Setting);
public sealed record PowerPlanInfo(string? Name, Guid? Id, bool? IsLaptop, string? Error);
