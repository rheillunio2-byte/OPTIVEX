using System.IO;

namespace OPTIVEX.App.Services;

/// <summary>Every place OPTIVEX writes to. All of it is under %LOCALAPPDATA%\OPTIVEX.</summary>
public static class AppPaths
{
    public static string DataDirectory { get; } =
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "OPTIVEX");

    public static string LogsDirectory { get; } = Path.Combine(DataDirectory, "logs");
    public static string ReportsDirectory { get; } = Path.Combine(DataDirectory, "reports");
    public static string HistoryDatabasePath { get; } = Path.Combine(DataDirectory, "history.db");
    public static string SettingsPath { get; } = Path.Combine(DataDirectory, "settings.json");
}
