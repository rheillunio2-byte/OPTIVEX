using System.Diagnostics;
using OPTIVEX.Core.Abstractions;
using Serilog;

namespace OPTIVEX.Infrastructure.Laptop;

/// <summary>
/// Runs Windows' own "powercfg /batteryreport" and writes the HTML into OPTIVEX's local reports folder.
/// It only creates a new file: nothing is deleted or modified, and no administrator rights are needed.
/// </summary>
public sealed class BatteryReportService : IBatteryReportService
{
    private readonly string _reportsDirectory;

    public BatteryReportService(string reportsDirectory) => _reportsDirectory = reportsDirectory;

    public async Task<string> CreateAsync(CancellationToken token = default)
    {
        Directory.CreateDirectory(_reportsDirectory);
        var path = Path.Combine(_reportsDirectory, $"battery-report-{DateTime.Now:yyyyMMdd-HHmmss}.html");

        var psi = new ProcessStartInfo("powercfg.exe", $"/batteryreport /output \"{path}\"")
        { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false, CreateNoWindow = true };

        try
        {
            using var p = Process.Start(psi) ?? throw new InvalidOperationException("Windows' powercfg tool did not start.");
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(token);
            cts.CancelAfter(TimeSpan.FromSeconds(45));
            var stdout = p.StandardOutput.ReadToEndAsync(cts.Token);
            var stderr = p.StandardError.ReadToEndAsync(cts.Token);
            await p.WaitForExitAsync(cts.Token);
            var message = (await stdout + " " + await stderr).Trim();

            if (p.ExitCode != 0 || !File.Exists(path))
            {
                Log.Warning("powercfg /batteryreport failed (exit {Code}): {Message}", p.ExitCode, message);
                throw new InvalidOperationException(string.IsNullOrWhiteSpace(message)
                    ? "Windows could not create a battery report. This PC may have no battery."
                    : "Windows could not create a battery report: " + message);
            }
            Log.Information("Battery report created at {Path}", path);
            return path;
        }
        catch (OperationCanceledException) when (!token.IsCancellationRequested)
        {
            throw new InvalidOperationException("Creating the battery report took too long and was stopped.");
        }
    }
}
