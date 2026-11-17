using System.Diagnostics;
using System.IO;
using OPTIVEX.Core.Safety;
using Serilog;

namespace OPTIVEX.App.Services;

/// <summary>Opens Explorer with a file selected. Read-only: it never moves or deletes anything.</summary>
public interface IShellService
{
    void RevealInExplorer(string path);
    /// <summary>Opens an HTML report that OPTIVEX itself created. Anything outside the reports folder is refused.</summary>
    void OpenReport(string path);
    /// <summary>Opens OPTIVEX's own data or log folder in Explorer. Any other folder is refused.</summary>
    void OpenFolder(string path);
}

public sealed class ShellService : IShellService
{
    public void RevealInExplorer(string path)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(path) || !Path.IsPathRooted(path) || !File.Exists(path)) return;
            Process.Start(new ProcessStartInfo("explorer.exe", $"/select,\"{path}\"") { UseShellExecute = false });
        }
        catch (Exception ex) { Log.Warning(ex, "Could not open Explorer for {Path}", path); }
    }

    public void OpenReport(string path)
    {
        try
        {
            if (!PathGuard.IsStrictlyInside(path, AppPaths.ReportsDirectory) ||
                !path.EndsWith(".html", StringComparison.OrdinalIgnoreCase) || !File.Exists(path))
            {
                Log.Warning("Refused to open {Path}: not an OPTIVEX report", path);
                return;
            }
            Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
        }
        catch (Exception ex) { Log.Warning(ex, "Could not open report {Path}", path); }
    }

    public void OpenFolder(string path)
    {
        try
        {
            bool allowed = PathGuard.AreSamePath(path, AppPaths.DataDirectory) || PathGuard.IsStrictlyInside(path, AppPaths.DataDirectory);
            if (!allowed || !Directory.Exists(path)) { Log.Warning("Refused to open folder {Path}", path); return; }
            Process.Start(new ProcessStartInfo("explorer.exe", $"\"{path}\"") { UseShellExecute = false });
        }
        catch (Exception ex) { Log.Warning(ex, "Could not open folder {Path}", path); }
    }
}
