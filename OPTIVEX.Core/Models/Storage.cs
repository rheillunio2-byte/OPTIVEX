using OPTIVEX.Core.Safety;

namespace OPTIVEX.Core.Models;

public sealed record StorageScanResult(IReadOnlyList<CleanupCandidate> Candidates, bool Truncated, int Inaccessible);

public sealed record ScanScope(string DisplayName, string Path);

/// <summary>A large file found by the analyzer. Read-only information: OPTIVEX never deletes these.</summary>
public sealed record LargeFile(string FullPath, long SizeBytes, DateTime LastModified)
{
    public string Name => System.IO.Path.GetFileName(FullPath);
    public string Folder => System.IO.Path.GetDirectoryName(FullPath) ?? "";
    public string SizeLabel => Formatting.ByteFormat.Format(SizeBytes);
    public string Kind => FileKind.FromPath(FullPath);
}

public sealed record LargeFileScanResult(IReadOnlyList<LargeFile> Files, long FilesScanned, bool Cancelled, int Inaccessible);
