using System.Windows;

namespace OPTIVEX.App.Services;

/// <summary>Abstracts message boxes so view models stay UI-free and testable.</summary>
public interface IDialogService
{
    bool Confirm(string title, string message);
    void Info(string title, string message);
    void Error(string title, string message);
    /// <summary>Returns a chosen .exe path, or null if cancelled.</summary>
    string? PickExecutable();
    /// <summary>Returns a chosen file path to save to, or null if cancelled.</summary>
    string? PickSavePath(string title, string filter, string defaultFileName);
}

public sealed class WpfDialogService : IDialogService
{
    /// <summary>Shows the app's dark dialog; if that ever fails, falls back to a standard message box so the user is never left without an answer.</summary>
    private static bool Show(string title, string message, DialogKind kind, string primary, string? secondary, bool defaultIsSecondary)
    {
        try
        {
            var dialog = new DialogWindow(title, message, kind, primary, secondary, defaultIsSecondary);
            var owner = Application.Current?.MainWindow;
            if (owner is { IsVisible: true } && !ReferenceEquals(owner, dialog)) dialog.Owner = owner;
            return dialog.ShowDialog() == true;
        }
        catch (Exception ex)
        {
            Serilog.Log.Warning(ex, "Custom dialog failed; using a standard message box");
            return secondary is null
                ? MessageBox.Show(message, title, MessageBoxButton.OK, kind == DialogKind.Error ? MessageBoxImage.Error : MessageBoxImage.Information) == MessageBoxResult.OK
                : MessageBox.Show(message, title, MessageBoxButton.YesNo, MessageBoxImage.Warning, MessageBoxResult.No) == MessageBoxResult.Yes;
        }
    }

    public bool Confirm(string title, string message) => Show(title, message, DialogKind.Warning, "Yes", "No", defaultIsSecondary: true);
    public void Info(string title, string message) => Show(title, message, DialogKind.Info, "OK", null, false);
    public void Error(string title, string message) => Show(title, message, DialogKind.Error, "OK", null, false);

    public string? PickSavePath(string title, string filter, string defaultFileName)
    {
        var dlg = new Microsoft.Win32.SaveFileDialog { Title = title, Filter = filter, FileName = defaultFileName, OverwritePrompt = true };
        return dlg.ShowDialog() == true ? dlg.FileName : null;
    }

    public string? PickExecutable()
    {
        var dlg = new Microsoft.Win32.OpenFileDialog { Filter = "Programs (*.exe)|*.exe", Title = "Choose the game's program" };
        return dlg.ShowDialog() == true ? dlg.FileName : null;
    }
}
