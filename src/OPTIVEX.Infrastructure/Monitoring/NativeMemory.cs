using System.Runtime.InteropServices;

namespace OPTIVEX.Infrastructure.Monitoring;

internal static class NativeMemory
{
    /// <summary>Physical memory in GB, or null when Windows does not answer.</summary>
    public static (double UsedGb, double TotalGb)? Read()
    {
        var m = new MemoryStatusEx { dwLength = (uint)Marshal.SizeOf<MemoryStatusEx>() };
        if (!GlobalMemoryStatusEx(ref m)) return null;
        return ((m.ullTotalPhys - m.ullAvailPhys) / 1073741824d, m.ullTotalPhys / 1073741824d);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MemoryStatusEx
    {
        public uint dwLength, dwMemoryLoad;
        public ulong ullTotalPhys, ullAvailPhys, ullTotalPageFile, ullAvailPageFile, ullTotalVirtual, ullAvailVirtual, ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatusEx buffer);
}
