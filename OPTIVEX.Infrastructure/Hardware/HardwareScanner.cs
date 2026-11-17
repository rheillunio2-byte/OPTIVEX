using System.Management;
using System.Runtime.InteropServices;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Models;
using Serilog;

namespace OPTIVEX.Infrastructure.Hardware;

/// <summary>Reads a point-in-time hardware inventory via WMI. Failed reads are logged, never invented.</summary>
public sealed class HardwareScanner : IHardwareScanner
{
    public Task<SystemSnapshot> ScanAsync(CancellationToken token = default) =>
        Task.Run(() =>
        {
            token.ThrowIfCancellationRequested();
            var cpus = QueryAll("Win32_Processor", "Name");
            string cpu = cpus.Count > 0 ? string.Join(" / ", cpus.Distinct()) : "Unavailable";

            int logical = QueryAll("Win32_Processor", "NumberOfLogicalProcessors")
                .Select(v => int.TryParse(v, out var n) ? n : 0).Sum();
            if (logical <= 0) logical = Environment.ProcessorCount;

            var gpus = QueryAll("Win32_VideoController", "Name").Distinct().ToList();
            string gpu = gpus.Count > 0 ? string.Join(" / ", gpus) : "Unavailable";

            double totalRam = 0;
            if (double.TryParse(QueryFirst("Win32_ComputerSystem", "TotalPhysicalMemory"), out var bytes))
                totalRam = bytes / 1073741824d; // WMI reports bytes

            double? usedRam = null;
            if (totalRam > 0 && double.TryParse(QueryFirst("Win32_OperatingSystem", "FreePhysicalMemory"), out var freeKb))
                usedRam = Math.Max(0, totalRam - freeKb / 1048576d); // WMI reports KB

            string caption = QueryFirst("Win32_OperatingSystem", "Caption") ?? "";
            string build = QueryFirst("Win32_OperatingSystem", "BuildNumber") ?? "";
            string os = string.IsNullOrWhiteSpace(caption)
                ? Environment.OSVersion.ToString()
                : $"{caption.Trim()}{(build.Length > 0 ? $" (build {build})" : "")}";

            var drives = new List<DriveSnapshot>();
            foreach (var d in DriveInfo.GetDrives())
            {
                try
                {
                    // Fixed drives only: network/removable media would distort capacity figures.
                    if (d.DriveType == DriveType.Fixed && d.IsReady)
                        drives.Add(new DriveSnapshot(d.Name, d.TotalSize / 1073741824d, d.AvailableFreeSpace / 1073741824d));
                }
                catch (Exception ex) { Log.Warning(ex, "Could not read drive {Drive}", d.Name); }
            }

            int physical = QueryAll("Win32_Processor", "NumberOfCores").Select(v => int.TryParse(v, out var n) ? n : 0).Sum();
            var boardParts = new[] { QueryFirst("Win32_BaseBoard", "Manufacturer"), QueryFirst("Win32_BaseBoard", "Product") }
                .Where(x => !string.IsNullOrWhiteSpace(x));
            string? board = boardParts.Any() ? string.Join(" ", boardParts) : null;

            Log.Information("Hardware scan complete: {Cpu}, {Gpu}, {Ram:0.0} GB RAM, {Drives} drive(s)", cpu, gpu, totalRam, drives.Count);
            return new SystemSnapshot(Environment.MachineName, os, cpu, logical, gpu, totalRam, usedRam, drives,
                physical > 0 ? physical : null, board, RuntimeInformation.OSArchitecture.ToString());
        }, token);

    private static string? QueryFirst(string cls, string prop) => QueryAll(cls, prop).FirstOrDefault();

    private static List<string> QueryAll(string cls, string prop)
    {
        var results = new List<string>();
        try
        {
            using var searcher = new ManagementObjectSearcher($"SELECT {prop} FROM {cls}");
            foreach (ManagementBaseObject item in searcher.Get())
            {
                using (item)
                {
                    var v = item[prop]?.ToString();
                    if (!string.IsNullOrWhiteSpace(v)) results.Add(v.Trim());
                }
            }
        }
        catch (Exception ex) { Log.Warning(ex, "WMI query failed: {Class}.{Property}", cls, prop); }
        return results;
    }
}
