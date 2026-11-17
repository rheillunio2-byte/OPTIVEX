namespace OPTIVEX.Core.Safety;

/// <summary>Which files in approved folders count as cleanup candidates, and how they are categorised.</summary>
public static class CleanupPolicy
{
    public const string Temp = "Temporary files";
    public const string Cache = "Application caches";
    public const string Logs = "Log files";
    public const string Dumps = "Crash dumps";

    /// <summary>Temp-like files must be at least this old, so files a running installer may still need are left alone.</summary>
    public static readonly TimeSpan MinAge = TimeSpan.FromHours(24);

    public static string Classify(string path, string rootCategory)
    {
        if (rootCategory != Temp) return rootCategory;
        return Path.GetExtension(path).ToLowerInvariant() switch
        {
            ".log" or ".etl" => Logs,
            ".dmp" or ".mdmp" => Dumps,
            _ => Temp
        };
    }

    public static bool IsEligible(string category, DateTime lastWriteUtc, DateTime nowUtc) =>
        category == Cache || nowUtc - lastWriteUtc >= MinAge;

    public static string Describe(string category) => category switch
    {
        Temp => "Leftover files in your temp folder, at least 24 hours old.",
        Cache => "Browser and graphics caches. Programs rebuild them; the first load afterwards may be slower.",
        Logs => "Old log files in the temp folder, at least 24 hours old.",
        Dumps => "Crash-dump files. Only useful if you are debugging a crash.",
        _ => ""
    };
}
