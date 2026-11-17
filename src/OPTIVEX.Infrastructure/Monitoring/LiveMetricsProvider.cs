using System.Diagnostics;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Health;
using OPTIVEX.Core.Models;
using Serilog;

namespace OPTIVEX.Infrastructure.Monitoring;

/// <summary>Live CPU, memory, process-count, uptime and sensor samples. Call SampleAsync about once per second.</summary>
public sealed class LiveMetricsProvider : ILiveMetricsProvider, IDisposable
{
    private readonly PerformanceCounter? _cpuCounter;
    private readonly string? _cpuCounterError;
    private readonly SensorService _sensors = new();
    private readonly object _gate = new();
    private TimeSpan _lastProcessCpu;
    private DateTime _lastWallUtc;
    private int _tick;
    private int? _processCount;

    public LiveMetricsProvider()
    {
        try
        {
            _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total", readOnly: true);
            _cpuCounter.NextValue(); // first value is always 0; prime it
        }
        catch (Exception ex)
        {
            _cpuCounterError = $"Windows performance counter unavailable ({ex.GetType().Name}).";
            Log.Warning(ex, "CPU performance counter failed to initialise");
        }
        using var self = Process.GetCurrentProcess();
        _lastProcessCpu = self.TotalProcessorTime;
        _lastWallUtc = DateTime.UtcNow;
    }

    public Task<LiveMetrics> SampleAsync(CancellationToken token = default) =>
        Task.Run(() =>
        {
            token.ThrowIfCancellationRequested();
            lock (_gate) // samples must not overlap: they share counter and delta state
            {
                SensorReading totalCpu;
                try { totalCpu = _cpuCounter is null ? SensorReading.Unavailable(_cpuCounterError ?? "Unavailable") : SensorReading.Ok(Math.Clamp(_cpuCounter.NextValue(), 0, 100)); }
                catch (Exception ex) { Log.Warning(ex, "CPU counter read failed"); totalCpu = SensorReading.Unavailable("Performance counter read failed."); }

                double appCpu = 0;
                try
                {
                    using var self = Process.GetCurrentProcess();
                    var now = DateTime.UtcNow; var cpu = self.TotalProcessorTime;
                    appCpu = CpuUsageCalculator.ProcessPercent(_lastProcessCpu, cpu, now - _lastWallUtc, Environment.ProcessorCount);
                    _lastProcessCpu = cpu; _lastWallUtc = now;
                }
                catch (Exception ex) { Log.Warning(ex, "Self CPU read failed"); }

                double? used = null, total = null;
                var mem = NativeMemory.Read();
                if (mem is not null) { used = mem.Value.UsedGb; total = mem.Value.TotalGb; }

                // Enumerating processes is comparatively slow: refresh every 5th sample.
                if (_tick++ % 5 == 0)
                {
                    try
                    {
                        var ps = Process.GetProcesses();
                        _processCount = ps.Length;
                        foreach (var p in ps) p.Dispose();
                    }
                    catch (Exception ex) { Log.Warning(ex, "Process count failed"); _processCount = null; }
                }

                var (cpuTemp, gpuTemp, gpuLoad) = _sensors.Read();
                return new LiveMetrics(DateTime.Now, totalCpu, appCpu, used, total, _processCount,
                    TimeSpan.FromMilliseconds(Environment.TickCount64), cpuTemp, gpuTemp, gpuLoad);
            }
        }, token);

    public void Dispose()
    {
        _cpuCounter?.Dispose();
        _sensors.Dispose();
    }
}
