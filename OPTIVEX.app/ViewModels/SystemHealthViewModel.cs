using OPTIVEX.Core.Reporting;
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LiveChartsCore;
using LiveChartsCore.SkiaSharpView;
using LiveChartsCore.SkiaSharpView.Painting;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Health;
using OPTIVEX.Core.Models;
using Serilog;
using SkiaSharp;

namespace OPTIVEX.App.ViewModels;

public partial class SystemHealthViewModel : PageViewModel
{
    private const int HistoryLength = 60; // one point per second
    private static readonly SKColor Cyan = new(0x58, 0xD6, 0xF5), Blue = new(0x39, 0x8B, 0xFF), Muted = new(0x9A, 0xA8, 0xBB);

    private readonly ILiveMetricsProvider _metrics;
    private readonly IHardwareScanner _scanner;
    private readonly SettingsService _appSettings;
    private readonly ObservableCollection<double> _cpuHistory = new(), _appCpuHistory = new(), _memHistory = new();
    private CancellationTokenSource? _cts;
    private bool _staticLoaded;

    public SystemHealthViewModel(ILiveMetricsProvider metrics, IHardwareScanner scanner, SettingsService appSettings)
        : base("System Health", "Live readings, refreshed at the speed chosen in Settings while this page is open. Unsupported sensors are labelled, never guessed.", "◉")
    {
        _metrics = metrics;
        _scanner = scanner;
        _appSettings = appSettings;
        CpuSeries = new ISeries[]
        {
            Line("System CPU", _cpuHistory, Cyan),
            Line("OPTIVEX", _appCpuHistory, new SKColor(0xF5, 0xB9, 0x42))
        };
        MemorySeries = new ISeries[] { Line("Memory", _memHistory, Blue) };
        TimeAxes = new[] { new Axis { IsVisible = false } };
        PercentAxes = new[]
        {
            new Axis
            {
                MinLimit = 0, MaxLimit = 100, MinStep = 25,
                LabelsPaint = new SolidColorPaint(Muted),
                SeparatorsPaint = new SolidColorPaint(new SKColor(0x2A, 0x38, 0x50)) { StrokeThickness = 1 }
            }
        };
    }

    public ISeries[] CpuSeries { get; }
    public ISeries[] MemorySeries { get; }
    public Axis[] TimeAxes { get; }
    public Axis[] PercentAxes { get; }
    public ObservableCollection<DriveItem> Drives { get; } = new();

    // Live readings
    [ObservableProperty] private string _cpuText = "—";
    [ObservableProperty] private string _cpuNote = "";
    [ObservableProperty] private HealthLevel _cpuLevel;
    [ObservableProperty] private string _appCpuText = "OPTIVEX: —";
    [ObservableProperty] private string _memText = "—";
    [ObservableProperty] private string _memNote = "";
    [ObservableProperty] private HealthLevel _memLevel;
    [ObservableProperty] private string _cpuTempText = "—";
    [ObservableProperty] private string _cpuTempNote = "";
    [ObservableProperty] private HealthLevel _cpuTempLevel;
    [ObservableProperty] private string _gpuTempText = "—";
    [ObservableProperty] private string _gpuTempNote = "";
    [ObservableProperty] private HealthLevel _gpuTempLevel;
    [ObservableProperty] private string _gpuLoadText = "—";
    [ObservableProperty] private string _gpuLoadNote = "";
    [ObservableProperty] private string _processText = "—";
    [ObservableProperty] private string _uptimeText = "—";
    [ObservableProperty] private string _statusText = "Waiting for first sample…";

    // Static hardware details
    [ObservableProperty] private string _cpuModel = "—";
    [ObservableProperty] private string _coresText = "—";
    [ObservableProperty] private string _gpuModel = "—";
    [ObservableProperty] private string _ramTotalText = "—";
    [ObservableProperty] private string _osText = "—";
    [ObservableProperty] private string _archText = "—";
    [ObservableProperty] private string _boardText = "—";

    private static LineSeries<double> Line(string name, ObservableCollection<double> values, SKColor color) => new()
    {
        Name = name, Values = values, GeometrySize = 0, LineSmoothness = 0.3,
        Stroke = new SolidColorPaint(color, 2), Fill = new SolidColorPaint(color.WithAlpha(40))
    };

    public override async Task OnNavigatedToAsync()
    {
        if (!_staticLoaded) await LoadStaticAsync();
        Start();
    }

    public override void OnNavigatedFrom() => Stop();

    [RelayCommand]
    private async Task RefreshHardwareAsync() => await LoadStaticAsync();

    private async Task LoadStaticAsync()
    {
        try
        {
            var s = await _scanner.ScanAsync();
            CpuModel = s.CpuName;
            CoresText = s.PhysicalCores is int p ? $"{p} cores / {s.LogicalProcessors} logical processors" : $"{s.LogicalProcessors} logical processors (core count not reported)";
            GpuModel = s.GpuName;
            RamTotalText = s.TotalRamGb > 0 ? $"{s.TotalRamGb:0.0} GB" : "Unavailable";
            OsText = s.WindowsVersion;
            ArchText = s.Architecture ?? "Unavailable";
            BoardText = s.Motherboard ?? "Not reported by this system";
            Drives.Clear();
            foreach (var d in s.Drives)
                Drives.Add(new DriveItem(d.Name, $"{d.FreeGb:0.0} GB free / {d.TotalGb:0.0} GB", d.UsedPercent));
            _staticLoaded = true;
        }
        catch (Exception ex) { Log.Error(ex, "Loading hardware details failed"); }
    }

    private void Start()
    {
        if (_cts is not null) return;
        _cts = new CancellationTokenSource();
        _ = RunAsync(_cts.Token);
    }

    private void Stop()
    {
        _cts?.Cancel();
        _cts?.Dispose();
        _cts = null;
    }

    private async Task RunAsync(CancellationToken ct)
    {
        try
        {
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(_appSettings.Current.LiveRefreshSeconds));
            do { Apply(await _metrics.SampleAsync(ct)); }
            while (await timer.WaitForNextTickAsync(ct));
        }
        catch (OperationCanceledException) { /* page left */ }
        catch (Exception ex)
        {
            Log.Error(ex, "Live monitoring stopped unexpectedly");
            StatusText = $"Live monitoring stopped: {ex.Message}";
        }
    }

    private static void Push(ObservableCollection<double> c, double v)
    {
        c.Add(v);
        while (c.Count > HistoryLength) c.RemoveAt(0);
    }

    private void Apply(LiveMetrics m)
    {
        if (m.TotalCpuPercent.Value is double cpu) { Push(_cpuHistory, cpu); CpuText = $"{cpu:0}%"; CpuNote = "Whole system"; }
        else { CpuText = "Unavailable"; CpuNote = m.TotalCpuPercent.Reason ?? ""; }
        CpuLevel = HealthThresholds.Classify(MetricKind.CpuUsage, m.TotalCpuPercent.Value);
        Push(_appCpuHistory, m.AppCpuPercent);
        AppCpuText = $"OPTIVEX itself: {m.AppCpuPercent:0.0}% of total CPU";

        if (m.MemoryUsedGb is double used && m.MemoryTotalGb is double total && m.MemoryPercent is double pct)
        {
            Push(_memHistory, pct);
            MemText = $"{pct:0}%";
            MemNote = $"{used:0.0} of {total:0.0} GB in use · {total - used:0.0} GB available";
        }
        else { MemText = "Unavailable"; MemNote = "Windows did not report memory status."; }
        MemLevel = HealthThresholds.Classify(MetricKind.MemoryUsage, m.MemoryPercent);

        (CpuTempText, CpuTempNote) = Show(m.CpuTempC, "0", "°C");
        CpuTempLevel = HealthThresholds.Classify(MetricKind.Temperature, m.CpuTempC.Value);
        (GpuTempText, GpuTempNote) = Show(m.GpuTempC, "0", "°C");
        GpuTempLevel = HealthThresholds.Classify(MetricKind.Temperature, m.GpuTempC.Value);
        (GpuLoadText, GpuLoadNote) = Show(m.GpuLoadPercent, "0", "%");

        ProcessText = m.ProcessCount is int n ? $"{n} running" : "Unavailable";
        UptimeText = FormatUptime(m.Uptime);
        StatusText = $"Updated {m.Timestamp:T}";
    }

    private static (string Text, string Note) Show(SensorReading r, string format, string unit) =>
        r.Value is double v ? ($"{v.ToString(format)}{unit}", "") : ("Unavailable", r.Reason ?? "");

    private static string FormatUptime(TimeSpan t) =>
        t.TotalDays >= 1 ? $"{(int)t.TotalDays}d {t.Hours}h {t.Minutes}m" : $"{t.Hours}h {t.Minutes}m";
}
