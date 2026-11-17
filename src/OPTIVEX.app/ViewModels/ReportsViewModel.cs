using System.Collections.ObjectModel;
using System.IO;
using System.Text;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OPTIVEX.App.Services;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Formatting;
using OPTIVEX.Core.Models;
using OPTIVEX.Core.Reporting;
using Serilog;

namespace OPTIVEX.App.ViewModels;

public sealed record SystemScanRow(SystemScanRecord Record, string Date, string Windows, string Memory, string Drives);
public sealed record StorageScanRow(string Date, string Files, string Size, string Note);
public sealed record CleanupRow(string Date, string Selected, string Deleted, string Recovered, string Skipped);
public sealed record ActionRow(string Date, string Action, string Target, string Details);
public sealed record AnalysisRow(string Date, string Count, string Issues);

/// <summary>Browse, compare and export the local history. Everything shown was recorded on this PC.</summary>
public partial class ReportsViewModel : PageViewModel
{
    private readonly IHistoryStore _store;
    private readonly SettingsService _settings;
    private readonly IDialogService _dialogs;
    private readonly IPrintService _print;
    private HistoryData _data = HistoryData.Empty;

    public ReportsViewModel(IHistoryStore store, SettingsService settings, IDialogService dialogs, IPrintService print)
        : base("Reports", "Scan history, cleanups and optimization actions saved on this PC. Compare scans and export reports.", "▥")
    {
        _store = store; _settings = settings; _dialogs = dialogs; _print = print;
    }

    public ObservableCollection<SystemScanRow> SystemRows { get; } = new();
    public ObservableCollection<StorageScanRow> StorageRows { get; } = new();
    public ObservableCollection<CleanupRow> CleanupRows { get; } = new();
    public ObservableCollection<ActionRow> ActionRows { get; } = new();
    public ObservableCollection<AnalysisRow> AnalysisRows { get; } = new();
    public ObservableCollection<MetricChange> Comparison { get; } = new();

    [ObservableProperty] private string _mode = "System";
    [ObservableProperty] private SystemScanRow? _selectedScan;
    [ObservableProperty] private string _comparisonTitle = "";
    [ObservableProperty] private string _statusText = "";
    [ObservableProperty] private string _historyNote = "";
    [ObservableProperty] private int _systemCount;
    [ObservableProperty] private int _storageCount;
    [ObservableProperty] private int _cleanupCount;
    [ObservableProperty] private int _actionCount;
    [ObservableProperty] private int _analysisCount;

    [RelayCommand] private void SetMode(string? mode) { if (mode is "System" or "Storage" or "Cleanups" or "Actions" or "Analyses") Mode = mode; }

    public override Task OnNavigatedToAsync() => ReloadAsync();

    private async Task ReloadAsync()
    {
        try
        {
            _data = await Task.Run(() => _store.LoadAll());
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Loading history failed");
            _data = HistoryData.Empty;
            StatusText = "Could not load history: " + ex.Message;
        }

        HistoryNote = _store is UnavailableHistoryStore u ? "The history database could not be opened (" + u.Reason + "). Nothing can be saved or shown."
            : !_settings.Current.SaveHistory ? "History saving is switched off in Settings. Entries saved earlier are shown below."
            : "";

        SystemRows.Clear(); StorageRows.Clear(); CleanupRows.Clear(); ActionRows.Clear(); AnalysisRows.Clear();
        foreach (var s in _data.SystemScans)
            SystemRows.Add(new SystemScanRow(s, ReportTables.Date(s.TakenAt), s.Windows,
                s.UsedRamGb is double used ? $"{used:0.0} / {s.TotalRamGb:0.0} GB in use" : $"{s.TotalRamGb:0.0} GB installed",
                string.Join(" · ", s.Drives.Select(d => $"{d.Name} {d.FreeGb:0} GB free"))));
        foreach (var s in _data.StorageScans)
            StorageRows.Add(new StorageScanRow(ReportTables.Date(s.TakenAt), s.Files.ToString("N0"), ByteFormat.Format(s.TotalBytes),
                string.Join("; ", s.Categories.Select(c => $"{c.Category} {ByteFormat.Format(c.Bytes)}")) + (s.Truncated ? " (list was capped)" : "")));
        foreach (var c in _data.Cleanups)
            CleanupRows.Add(new CleanupRow(ReportTables.Date(c.TakenAt), c.Selected.ToString("N0"), c.Deleted.ToString("N0"), ByteFormat.Format(c.Bytes), c.Skipped.ToString("N0")));
        foreach (var a in _data.Actions)
            ActionRows.Add(new ActionRow(ReportTables.Date(a.TakenAt), a.Action, a.Target, a.Details));
        foreach (var a in _data.Analyses)
            AnalysisRows.Add(new AnalysisRow(ReportTables.Date(a.TakenAt), a.Recommendations.ToString(), a.Issues.Count == 0 ? "Nothing to recommend" : string.Join("; ", a.Issues)));

        SystemCount = SystemRows.Count; StorageCount = StorageRows.Count; CleanupCount = CleanupRows.Count; ActionCount = ActionRows.Count; AnalysisCount = AnalysisRows.Count;
        SelectedScan = SystemRows.FirstOrDefault();
        if (SystemRows.Count == 0) { Comparison.Clear(); ComparisonTitle = ""; }
    }

    partial void OnSelectedScanChanged(SystemScanRow? value)
    {
        Comparison.Clear();
        if (value is null) { ComparisonTitle = ""; return; }
        int i = _data.SystemScans.ToList().FindIndex(s => s.Id == value.Record.Id);
        if (i < 0 || i + 1 >= _data.SystemScans.Count)
        {
            ComparisonTitle = "This is the earliest recorded scan, so there is nothing to compare it with.";
            return;
        }
        var previous = _data.SystemScans[i + 1];
        ComparisonTitle = $"Changes since the previous scan ({ReportTables.Date(previous.TakenAt)})";
        foreach (var c in HistoryComparer.Compare(previous, value.Record)) Comparison.Add(c);
    }

    // ---------------- export ----------------
    private static string Stamp => DateTime.Now.ToString("yyyyMMdd-HHmm");

    [RelayCommand]
    private void ExportText()
    {
        var path = _dialogs.PickSavePath("Save report as text", "Text file (*.txt)|*.txt", $"optivex-report-{Stamp}.txt");
        if (path is null) return;
        Save(path, ReportBuilder.BuildText(_data, DateTime.Now, AppInfo.Version), new UTF8Encoding(false));
    }

    [RelayCommand]
    private void ExportCsv()
    {
        var dataset = Mode switch
        {
            "Storage" => HistoryDataset.StorageScans,
            "Cleanups" => HistoryDataset.Cleanups,
            "Actions" => HistoryDataset.Actions,
            "Analyses" => HistoryDataset.Analyses,
            _ => HistoryDataset.SystemScans
        };
        var table = ReportTables.For(dataset, _data);
        if (table.Rows.Count == 0) { StatusText = $"Nothing to export: no {table.Title.ToLowerInvariant()} have been recorded."; return; }
        var path = _dialogs.PickSavePath($"Save {table.Title.ToLowerInvariant()} as CSV", "CSV file (*.csv)|*.csv", $"optivex-{dataset.ToString().ToLowerInvariant()}-{Stamp}.csv");
        if (path is null) return;
        Save(path, CsvExporter.Write(table.Headers, table.Rows), new UTF8Encoding(true)); // BOM so Excel reads UTF-8 correctly
    }

    [RelayCommand]
    private void PrintReport()
    {
        try
        {
            bool sent = _print.PrintText("OPTIVEX report", ReportBuilder.BuildText(_data, DateTime.Now, AppInfo.Version));
            StatusText = sent ? "Sent to the print dialog's printer. To get a PDF, choose “Microsoft Print to PDF” there." : "Printing cancelled.";
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Printing the report failed");
            _dialogs.Error("Print report", "Could not print: " + ex.Message);
        }
    }

    private void Save(string path, string content, Encoding encoding)
    {
        try
        {
            File.WriteAllText(path, content, encoding);
            StatusText = "Saved " + path;
            Log.Information("Report exported to {Path}", path);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Log.Warning(ex, "Saving report to {Path} failed", path);
            _dialogs.Error("Save report", "Could not save the file: " + ex.Message);
        }
    }
}
