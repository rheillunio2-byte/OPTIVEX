using System.Globalization;

namespace OPTIVEX.Core.Formatting;

public static class ByteFormat
{
    public static string Format(long bytes)
    {
        var ci = CultureInfo.InvariantCulture;
        if (bytes < 0) bytes = 0;
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024L * 1024) return string.Format(ci, "{0:0.0} KB", bytes / 1024d);
        if (bytes < 1024L * 1024 * 1024) return string.Format(ci, "{0:0.0} MB", bytes / 1048576d);
        return string.Format(ci, "{0:0.00} GB", bytes / 1073741824d);
    }
}
