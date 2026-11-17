using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OPTIVEX.App.Services;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Health;
using OPTIVEX.Core.Intelligence;
using OPTIVEX.Core.Models;
using OPTIVEX.Core.Performance;
using Serilog;

namespace OPTIVEX.App.ViewModels;

/// <summary>Battery, power plan and temperature readings with their limits stated, plus laptop-relevant recommendations.</summary>
public partial class LaptopCareViewModel : PageViewModel
{
    private static readonly HashSet<RecommendationCategory> Categories = new() { RecommendationCategory.Battery, RecommendationCategory.Thermal, RecommendationCategory.Power };

    private readonly IBatteryProvider _battery;
    private readonly ILiveMetricsProvider _live;
    private readonly ISystemSettingsReader _settings;
    private readonly IBatteryReportService _report;
    private readonly IShellService _shell;
    private readonly IDialogService _dialogs;
    private readonly NavigationService _nav;
    private CancellationTokenSource? _cts;
    private PowerPlanInfo? _plan;
    private int _tick;

    public LaptopCareViewModel(IBatteryProvider battery, ILiveMetricsProvider live, ISystemSettingsReader settings,
        IBatteryReportService report, IShellService shell, IDialogService dialogs, NavigationService nav)
        : base("Laptop Care", "Battery, power and temperature readings where your hardware supports them. Unavailable readings are explained, never guessed.", "⌂")
    {
        _battery = battery; _live = live; _settings = settings; _report = report; _shell = shell; _dialogs = dialogs; _nav = nav;
    }

    public ObservableCollection<RecommendationRow> Recommendations { get; } = new();
    public ObservableCollection<string> NotAssessed { get; } = new();

    [ObservableProperty, NotifyCanExecuteChangedFor(nameof(CreateReportCommand))] private bool _hasBattery;
    [ObservableProperty, NotifyCanExecuteChangedFor(nameof(CreateReportCommand))] private bool _isCreatingReport;
    [ObservableProperty] private string _noBatteryReason = "";
    [ObservableProperty] private string _batteryName = "";
    [ObservableProperty] private string _chargeText = "—";
    [ObservableProperty] private string _chargeNote = "";
    [ObservableProperty] private string _healthText = "—";
    [ObservableProperty] private string _healthNote = "";
    [ObservableProperty] private HealthLevel _batteryHealthLevel;
    [ObservableProperty] private string _designText = "—";
    [ObservableProperty] private string _designNote = "";
    [ObservableProperty] private string _fullText = "—";
    [ObservableProperty] private string _fullNote = "";
    [ObservableProperty] private string _cycleText = "—";
    [ObservableProperty] private string _cycleNote = "";
    [ObservableProperty] private string _powerPlanName = "—";
    [ObservableProperty] private string _powerPlanAdvice = "";
    [ObservableProperty] private string _cpuTempText = "—";
    [ObservableProperty] private string _cpuTempNote = "";
    [ObservableProperty] private HealthLevel _cpuTempLevel;
    [ObservableProperty] private string _gpuTempText = "—";
    [ObservableProperty] private string _gpuTempNote = "";
    [ObservableProperty] private HealthLevel _gpuTempLevel;
    [ObservableProperty] private bool _hasNotAssessed;
    [ObservableProperty] private string _statusText = "Reading…";

    public override Task OnNavigatedToAsync()
    {
        if (_cts is not null) return Task.CompletedTask;
        _tick = 0;
        _cts = new CancellationTokenSource();
        _ = RunAsync(_cts.Token);
        return Task.CompletedTask;
    }

    public override void OnNavigatedFrom()
    {
        _cts?.Cancel();
        _cts?.Dispose();
        _cts = null;
    }

    private async Task RunAsync(CancellationToken ct)
    {
        try
        {
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(5));
            do
            {
                var battery = await _battery.ReadAsync(ct);
                var live = await _live.SampleAsync(ct);
                if (_tick++ % 6 == 0) _plan = await _settings.ReadPowerPlanAsync(ct); // spawns powercfg: refresh every ~30 s
                Apply(battery, live);
            }
            while (await timer.WaitForNextTickAsync(ct));
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            Log.Error(ex, "Laptop Care monitoring stopped");
            StatusText = "Monitoring stopped: " + ex.Message;
        }
    }

    private static string Wh(SensorReading r) => r.Value is double v ? $"{v:0.0} Wh" : "Unavailable";

    private static string Runtime(SensorReading r) =>
        r.Value is double m ? $"About {(int)m / 60} h {(int)m % 60} min left" : (r.Reason ?? "");

    private void Apply(BatteryInfo b, LiveMetrics live)
    {
        HasBattery = b.Present;
        NoBatteryReason = b.NotPresentReason ?? "";

        if (b.Present)
        {
            BatteryName = string.Join(" · ", new[] { b.Name, b.Chemistry }.Where(x => !string.IsNullOrWhiteSpace(x)));
            ChargeText = b.ChargePercent.Value is double c ? $"{c:0}%" : "Unavailable";
            ChargeNote = BatteryStateMapper.Describe(b.State) + (b.State == BatteryState.Discharging ? ". " + Runtime(b.RuntimeMinutes) : "");

            var a = BatteryHealth.Assess(b.DesignCapacityWh, b.FullChargeCapacityWh);
            HealthText = a.Reliable ? $"{a.HealthPercent:0}%" : "Unavailable";
            HealthNote = a.Reliable ? $"About {a.WearPercent:0}% wear, estimated from the capacity figures Windows reports." : a.Reason ?? "";
            BatteryHealthLevel = BatteryHealth.Level(a.HealthPercent);

            DesignText = Wh(b.DesignCapacityWh); DesignNote = b.DesignCapacityWh.Value is null ? b.DesignCapacityWh.Reason ?? "" : "Capacity when new";
            FullText = Wh(b.FullChargeCapacityWh); FullNote = b.FullChargeCapacityWh.Value is null ? b.FullChargeCapacityWh.Reason ?? "" : "Capacity at a full charge today";
            CycleText = b.CycleCount.Value is double cy ? $"{cy:0}" : "Unavailable";
            CycleNote = b.CycleCount.Value is null ? b.CycleCount.Reason ?? "" : "As reported by the battery";
        }

        (CpuTempText, CpuTempNote) = live.CpuTempC.Value is double ct ? ($"{ct:0}°C", "") : ("Unavailable", live.CpuTempC.Reason ?? "");
        CpuTempLevel = HealthThresholds.Classify(MetricKind.Temperature, live.CpuTempC.Value);
        (GpuTempText, GpuTempNote) = live.GpuTempC.Value is double gt ? ($"{gt:0}°C", "") : ("Unavailable", live.GpuTempC.Reason ?? "");
        GpuTempLevel = HealthThresholds.Classify(MetricKind.Temperature, live.GpuTempC.Value);

        if (_plan is not null)
        {
            PowerPlanName = _plan.Name ?? _plan.Id?.ToString() ?? "Unknown";
            PowerPlanAdvice = PowerAdvice.ForPlan(_plan);
        }

        var report = RecommendationEngine.Analyze(
            new SystemContext(null, live, null, null, _plan, null, b, Array.Empty<string>()), Categories);
        Recommendations.Clear();
        foreach (var r in report.Items) Recommendations.Add(RecommendationRow.From(r, _nav));
        NotAssessed.Clear();
        foreach (var n in report.NotAssessed) NotAssessed.Add(n);
        HasNotAssessed = NotAssessed.Count > 0;
        StatusText = $"Updated {DateTime.Now:T} · refreshes every 5 seconds while this page is open";
    }

    private bool CanCreateReport() => HasBattery && !IsCreatingReport;

    [RelayCommand(CanExecute = nameof(CanCreateReport))]
    private async Task CreateReportAsync()
    {
        if (!_dialogs.Confirm("Create Windows battery report",
                "Windows will write a battery report (an HTML file) into OPTIVEX's local reports folder and OPTIVEX will open it.\n\n" +
                "It shows usage history and, on many PCs, the cycle count. Nothing is changed or deleted and nothing is sent anywhere.\n\nContinue?")) return;
        IsCreatingReport = true;
        try
        {
            var path = await _report.CreateAsync();
            _shell.OpenReport(path);
            StatusText = "Battery report created: " + path;
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Battery report failed");
            _dialogs.Error("Battery report", ex.Message);
        }
        finally { IsCreatingReport = false; }
    }
}
