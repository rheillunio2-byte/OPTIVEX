using OPTIVEX.Core.Formatting;

namespace OPTIVEX.Core.Models;

public sealed record CleanupCandidate(string FullPath, long SizeBytes, string Category, DateTime LastModified)
{
    public string DisplayName => Path.GetFileName(FullPath);
    public string SizeLabel => ByteFormat.Format(SizeBytes);
}
