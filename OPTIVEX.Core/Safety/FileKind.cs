namespace OPTIVEX.Core.Safety;

/// <summary>Plain-language file type hint for the large-file analyzer (informational only).</summary>
public static class FileKind
{
    public static string FromPath(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".mp4" or ".mkv" or ".avi" or ".mov" or ".wmv" => "Video",
        ".zip" or ".rar" or ".7z" or ".tar" or ".gz" => "Archive",
        ".iso" or ".img" or ".vhd" or ".vhdx" or ".vmdk" => "Disk image",
        ".exe" or ".msi" => "Program / installer",
        ".pst" or ".ost" => "Mail data",
        ".mp3" or ".flac" or ".wav" => "Audio",
        "" => "No extension",
        _ => "Other"
    };
}
