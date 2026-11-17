namespace OPTIVEX.Core.Safety;

/// <summary>
/// Path validation used before any destructive file operation.
/// All checks compare fully-resolved paths with an explicit directory-separator
/// boundary, so "C:\Temp2\a.txt" is never treated as being inside "C:\Temp".
/// Pure logic (no file-system access) so it can be unit-tested on any OS.
/// </summary>
public static class PathGuard
{
    private static StringComparison Comparison =>
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    private static string? Normalize(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        try { return Path.GetFullPath(path); }
        catch (Exception e) when (e is ArgumentException or NotSupportedException or PathTooLongException) { return null; }
    }

    /// <summary>True when the path is a drive/filesystem root such as "C:\" or "/".</summary>
    public static bool IsFilesystemRoot(string? path)
    {
        var full = Normalize(path);
        if (full is null) return true; // unresolvable paths are treated as unsafe
        var root = Path.GetPathRoot(full);
        return root is not null && string.Equals(full, root, Comparison);
    }

    /// <summary>True when two paths resolve to the same directory (trailing separators ignored).</summary>
    public static bool AreSamePath(string? a, string? b)
    {
        var fa = Normalize(a); var fb = Normalize(b);
        if (fa is null || fb is null) return false;
        return string.Equals(Path.TrimEndingDirectorySeparator(fa), Path.TrimEndingDirectorySeparator(fb), Comparison);
    }

    /// <summary>
    /// True only when <paramref name="path"/> is located below <paramref name="root"/>
    /// (never the root itself, never a sibling with a shared name prefix, never via "..").
    /// A filesystem root is never accepted as an allowed root.
    /// </summary>
    public static bool IsStrictlyInside(string? path, string? root)
    {
        var full = Normalize(path); var rootFull = Normalize(root);
        if (full is null || rootFull is null || IsFilesystemRoot(rootFull)) return false;
        var boundary = Path.TrimEndingDirectorySeparator(rootFull) + Path.DirectorySeparatorChar;
        return full.Length > boundary.Length && full.StartsWith(boundary, Comparison);
    }

    /// <summary>True when the file sits directly inside the root (no sub-directories).</summary>
    public static bool IsDirectChild(string? path, string? root)
    {
        if (!IsStrictlyInside(path, root)) return false;
        return AreSamePath(Path.GetDirectoryName(Normalize(path)), root);
    }
}
