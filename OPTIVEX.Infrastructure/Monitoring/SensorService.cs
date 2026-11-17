using System.Security.Principal;
using LibreHardwareMonitor.Hardware;
using OPTIVEX.Core.Models;
using Serilog;

namespace OPTIVEX.Infrastructure.Monitoring;

/// <summary>
/// Temperature / GPU-load readings through LibreHardwareMonitor. Many CPUs only expose temperature
/// to administrators, and some hardware exposes nothing. In those cases we return an
/// "unavailable" reading with an honest reason. OPTIVEX never self-elevates.
/// </summary>
internal sealed class SensorService : IDisposable
{
    private readonly Computer? _computer;
    private readonly string? _openError;
    private readonly bool _isAdmin;

    public SensorService()
    {
        _isAdmin = IsAdministrator();
        try
        {
            _computer = new Computer { IsCpuEnabled = true, IsGpuEnabled = true };
            _computer.Open();
        }
        catch (Exception ex)
        {
            _openError = ex.Message;
            _computer = null;
            Log.Warning(ex, "Sensor library failed to start");
        }
    }

    public (SensorReading CpuTemp, SensorReading GpuTemp, SensorReading GpuLoad) Read()
    {
        if (_computer is null)
        {
            var r = SensorReading.Unavailable($"Sensor library could not start ({_openError ?? "unknown reason"}).");
            return (r, r, r);
        }

        double? cpuPackage = null, cpuMax = null;
        (int Priority, double Value)? gpuTemp = null, gpuLoad = null;

        try
        {
            foreach (var hw in _computer.Hardware)
            {
                Visit(hw);
                foreach (var sub in hw.SubHardware) Visit(sub);
            }
        }
        catch (Exception ex) { Log.Warning(ex, "Sensor read failed"); }

        void Visit(IHardware hw)
        {
            hw.Update();
            bool isCpu = hw.HardwareType == HardwareType.Cpu;
            bool isGpu = hw.HardwareType is HardwareType.GpuNvidia or HardwareType.GpuAmd or HardwareType.GpuIntel;
            int priority = hw.HardwareType == HardwareType.GpuIntel ? 1 : 0; // prefer discrete GPUs
            foreach (var s in hw.Sensors)
            {
                if (s.Value is not float f || float.IsNaN(f)) continue;
                if (isCpu && s.SensorType == SensorType.Temperature)
                {
                    cpuMax = Math.Max(cpuMax ?? f, f);
                    if (s.Name.Contains("Package", StringComparison.OrdinalIgnoreCase) ||
                        s.Name.Contains("Tctl", StringComparison.OrdinalIgnoreCase) ||
                        s.Name.Contains("Tdie", StringComparison.OrdinalIgnoreCase)) cpuPackage = f;
                }
                else if (isGpu && s.SensorType == SensorType.Temperature && s.Name.Contains("Core", StringComparison.OrdinalIgnoreCase))
                {
                    if (gpuTemp is null || priority < gpuTemp.Value.Priority) gpuTemp = (priority, f);
                }
                else if (isGpu && s.SensorType == SensorType.Load && s.Name.Equals("GPU Core", StringComparison.OrdinalIgnoreCase))
                {
                    if (gpuLoad is null || priority < gpuLoad.Value.Priority) gpuLoad = (priority, f);
                }
            }
        }

        double? cpu = cpuPackage ?? cpuMax;
        return (
            cpu is double c ? SensorReading.Ok(c) : SensorReading.Unavailable(_isAdmin
                ? "This CPU or motherboard does not expose a temperature reading."
                : "Not available. CPU temperature usually requires running OPTIVEX as administrator; some hardware never exposes it."),
            gpuTemp is { } gt ? SensorReading.Ok(gt.Value) : SensorReading.Unavailable("No GPU temperature reported by the GPU driver/hardware."),
            gpuLoad is { } gl ? SensorReading.Ok(gl.Value) : SensorReading.Unavailable("No GPU utilisation reported by the GPU driver/hardware."));
    }

    private static bool IsAdministrator()
    {
        try
        {
            using var id = WindowsIdentity.GetCurrent();
            return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch { return false; }
    }

    public void Dispose()
    {
        try { _computer?.Close(); } catch (Exception ex) { Log.Debug(ex, "Sensor library close failed"); }
    }
}
