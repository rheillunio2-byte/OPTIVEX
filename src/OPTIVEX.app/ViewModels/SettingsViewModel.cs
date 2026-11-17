using System.IO;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OPTIVEX.App.Services;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Models;
using OPTIVEX.Core.Reporting;
using Serilog;

namespace OPTIVEX.App.ViewModels;

public partial class SettingsViewModel : PageViewModel
{
    private readonly SettingsService _settings;
    private readonly IHistoryStore _store;
    private readonly IDialogService _dialogs;
    private readonly IShellService _shell;

    public SettingsViewModel(SettingsService settings, IHistoryStore store, IDialogService dialogs, IShellService shell)
        : base("Settings", "Preferences and privacy. OPTIVEX keeps everything on this PC and sends nothing anywhere.", "⚙")
    {
        _settings = settings; _store = store; _dialogs = dialogs; _shell = shell;
        Sync();
    }

    public string VersionText => $"OPTIVEX {AppInfo.Version}";
    public string DataFolder => AppPaths.DataDirectory;
    public string LogsFolder => AppPaths.LogsDirectory;

    // Mode strings drive the highlighted buttons.
    [ObservableProperty] private string _saveHistoryMode = "On";
    [ObservableProperty] private string _retentionMode = "365";
    [ObservableProperty] private string _refreshMode = "2";
    [ObservableProperty] private string _statusText = "";

    private void Sync()
    {
        var c = _settings.Current;
        SaveHistoryMode = c.SaveHistory ? "On" : "Off";
        RetentionMode = c.HistoryRetentionDays.ToString();
        RefreshMode = c.LiveRefreshSeconds.ToString();
    }

    private void Apply(Func<AppSettings, AppSettings> change, string message)
    {
        try
        {
            _settings.Update(change);
            StatusText = message;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Log.Warning(ex, "Saving settings failed");
            StatusText = "Could not save settings: " + ex.Message;
        }
        Sync();
    }

    [RelayCommand]
    private void SetSaveHistory(string? mode)
    {
        if (mode is not ("On" or "Off")) return;
        Apply(s => s with { SaveHistory = mode == "On" },
            mode == "On" ? "History saving is on." : "History saving is off. Nothing new will be recorded. Existing history is kept until you clear it.");
    }

    [RelayCommand]
    private void SetRetention(string? days)
    {
        if (!int.TryParse(days, out var d) || !AppSettings.RetentionOptions.Contains(d)) return;
        Apply(s => s with { HistoryRetentionDays = d },
            d == 0 ? "History will be kept until you clear it." : $"History older than {d} days is removed each time OPTIVEX starts.");
    }

    [RelayCommand]
    private void SetRefresh(string? seconds)
    {
        if (!int.TryParse(seconds, out var n) || !AppSettings.RefreshOptions.Contains(n)) return;
        Apply(s => s with { LiveRefreshSeconds = n }, $"Live pages will refresh every {n} second(s) the next time you open them.");
    }

    [RelayCommand]
    private void ClearHistory()
    {
        if (!_dialogs.Confirm("Clear history",
                "Delete all saved scan history, cleanup history, optimization actions and analyses?\n\n" +
                "This cannot be undone. Your settings, game profiles and your own games are not affected, and files on your PC are not touched.")) return;
        try
        {
            _store.ClearAll();
            Log.Information("History cleared by user");
            StatusText = "History cleared.";
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Clearing history failed");
            _dialogs.Error("Clear history", "Could not clear history: " + ex.Message);
        }
    }

    [RelayCommand] private void OpenDataFolder() => _shell.OpenFolder(AppPaths.DataDirectory);
    [RelayCommand] private void OpenLogsFolder() => _shell.OpenFolder(AppPaths.LogsDirectory);
}
