using OPTIVEX.Core.Reporting;
using OPTIVEX.App.Services;
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Intelligence;
using Serilog;

namespace OPTIVEX.App.ViewModels;

public sealed record DriveItem(string Name, string Summary, double UsedPercent);

public partial class OverviewViewModel : PageViewModel
{
    private readonly IHardwareScanner _scanner;
    private readonly SystemAnalyzer _analyzer;
    private readonly IHistoryRecorder _history;
    private readonly NavigationService _nav;
    private readonly SettingsService _settings;
    private bool _hasScanned;

    public OverviewViewModel(IHardwareScanner scanner, SystemAnalyzer analyzer, IHistoryRecorder history,
        NavigationService nav, SettingsService settings)
        : base("Overview", "Understand your PC. Make informed improvements.", "▦")
    {
        _scanner = scanner;
        _analyzer = analyzer;
        _history = history;
        _nav = nav;
        _settings = settings;
        _showWelcome = !settings.Current.WelcomeDismissed;
    }

    public ObservableCollection<RecommendationRow> Recommendations { get; } = new();
    public ObservableCollection<string> NotAssessed { get; } = new();

    [ObservableProperty] private bool _isAnalyzing;
    [ObservableProperty] private bool _showWelcome;
    [ObservableProperty] private double _ramPercent;
    [ObservableProperty] private bool _hasNotAssessed;
    [ObservableProperty] private string _analysisStatus =
        "Click “Analyze my PC” for recommendations based on your actual readings. OPTIVEX applies none of them automatically.";

    /// <summary>Opens another page (quick-action tiles).</summary>
    [RelayCommand]
    private void Open(string? page)
    {
        if (!string.IsNullOrWhiteSpace(page)) _nav.NavigateTo(page);
    }

    [RelayCommand]
    private void DismissWelcome()
    {
        ShowWelcome = false;
        try { _settings.Update(s => s with { WelcomeDismissed = true }); }
        catch (Exception ex) { Log.Warning(ex, "Could not remember that the welcome card was dismissed"); }
    }

    [RelayCommand]
    private async Task AnalyzeAsync()
    {
        IsAnalyzing = true;
        AnalysisStatus = "Analyzing… OPTIVEX is sampling your PC for a few seconds.";
        try
        {
            var report = await _analyzer.AnalyzeAsync();
            Recommendations.Clear();
            foreach (var r in report.Items) Recommendations.Add(RecommendationRow.From(r, _nav));
            NotAssessed.Clear();
            foreach (var n in report.NotAssessed) NotAssessed.Add(n);
            HasNotAssessed = NotAssessed.Count > 0;
            _history.RecordAnalysis(report);
            AnalysisStatus = report.Items.Count == 0
                ? $"Nothing to recommend based on the readings taken at {report.GeneratedAt:t}."
                : $"{report.Items.Count} recommendation(s) from readings taken at {report.GeneratedAt:t}. OPTIVEX applies none of them automatically.";
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Analysis failed");
            AnalysisStatus = "Analysis failed: " + ex.Message;
        }
        finally { IsAnalyzing = false; }
    }

    public ObservableCollection<DriveItem> Drives { get; } = new();

    [ObservableProperty] private string _cpuName = "Not scanned yet";
    [ObservableProperty] private string _cpuDetail = "";
    [ObservableProperty] private string _gpuName = "Not scanned yet";
    [ObservableProperty] private string _ramText = "—";
    [ObservableProperty] private string _ramDetail = "";
    [ObservableProperty] private string _statusText = "Not scanned yet";
    [ObservableProperty] private bool _isBusy;

    public override async Task OnNavigatedToAsync()
    {
        if (!_hasScanned) await ScanAsync();
    }

    [RelayCommand]
    private async Task ScanAsync()
    {
        IsBusy = true;
        StatusText = "Scanning hardware…";
        try
        {
            var s = await _scanner.ScanAsync();
            CpuName = s.CpuName;
            CpuDetail = $"Logical processors: {s.LogicalProcessors}";
            GpuName = s.GpuName;
            if (s.TotalRamGb <= 0) { RamText = "Unavailable"; RamDetail = "Windows did not report memory size"; }
            else if (s.UsedRamGb is null) { RamText = $"{s.TotalRamGb:0.0} GB total"; RamDetail = "Current usage unavailable"; }
            else { RamText = $"{s.UsedRamGb:0.0} / {s.TotalRamGb:0.0} GB"; RamDetail = $"{s.UsedRamGb / s.TotalRamGb * 100:0}% used"; }

            RamPercent = s.UsedRamGb is double usedGb && s.TotalRamGb > 0 ? usedGb / s.TotalRamGb * 100 : 0;
            Drives.Clear();
            foreach (var d in s.Drives)
                Drives.Add(new DriveItem(d.Name, $"{d.FreeGb:0.0} GB free / {d.TotalGb:0.0} GB", d.UsedPercent));

            Subtitle = $"{s.ComputerName} · {s.WindowsVersion}";
            StatusText = $"Updated {DateTime.Now:t}";
            _history.RecordSystemScan(s);
            _hasScanned = true;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "System scan failed");
            StatusText = $"Scan failed: {ex.Message}";
        }
        finally { IsBusy = false; }
    }
}
