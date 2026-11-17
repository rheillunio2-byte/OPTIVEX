using OPTIVEX.Core.Reporting;
using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OPTIVEX.App.Services;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Models;
using OPTIVEX.Core.Performance;
using Serilog;

namespace OPTIVEX.App.ViewModels;

public sealed record ProcessRow(string Name, string Instances, string Cpu, string Memory, string Note);
public sealed record ObservationRow(string Icon, string Title, string Detail);

public partial class StartupItemViewModel : ObservableObject
{
    public StartupItemViewModel(StartupEntry entry) { Entry = entry; _isEnabled = entry.IsEnabled; }
    public StartupEntry Entry { get; }
    public string Name => Entry.Name;
    public string Publisher => Entry.Publisher ?? "Unknown";
    public string Source => Entry.SourceLabel;
    public string Command => Entry.Command;
    public bool CanToggle => !Entry.IsProtected;
    public string ToolTipText => Entry.IsProtected ? "Windows security components are protected and cannot be changed here." : "Reversible: nothing is deleted.";

    [ObservableProperty, NotifyPropertyChangedFor(nameof(StatusText), nameof(ActionLabel))]
    private bool _isEnabled;

    public string StatusText => Entry.IsProtected ? (IsEnabled ? "Enabled (protected)" : "Disabled (protected)") : (IsEnabled ? "Enabled" : "Disabled");
    public string ActionLabel => IsEnabled ? "Disable" : "Enable";
}

/// <summary>Processes, startup entries and power/visual advice. Everything here observes or reversibly toggles; nothing terminates processes or changes services.</summary>
public partial class PerformanceViewModel : PageViewModel
{
    private readonly IProcessMonitor _processes;
    private readonly IStartupManager _startup;
    private readonly ISystemSettingsReader _settings;
    private readonly IDialogService _dialogs;
    private readonly IHistoryRecorder _history;
    private readonly SettingsService _appSettings;
    private CancellationTokenSource? _cts;
    private ProcessSnapshot? _last;
    private bool _settingsLoaded;

    public PerformanceViewModel(IProcessMonitor processes, IStartupManager startup, ISystemSettingsReader settings, IDialogService dialogs,
        IHistoryRecorder history, SettingsService appSettings)
        : base("Performance", "Find resource-heavy programs and startup entries. OPTIVEX explains first and never ends processes or changes services.", "⌁")
    {
        _processes = processes; _startup = startup; _settings = settings; _dialogs = dialogs; _history = history; _appSettings = appSettings;
    }

    public ObservableCollection<ProcessRow> Processes { get; } = new();
    public ObservableCollection<ObservationRow> Observations { get; } = new();
    public ObservableCollection<StartupItemViewModel> StartupItems { get; } = new();

    [ObservableProperty] private string _mode = "Processes";
    [ObservableProperty] private string _sortBy = "CPU";
    [ObservableProperty] private string _processSummary = "Measuring…";
    [ObservableProperty] private string _startupSummary = "";
    [ObservableProperty] private string _powerName = "—";
    [ObservableProperty] private string _powerAdviceText = "";
    [ObservableProperty] private string _visualAdviceText = "";

    [RelayCommand] private void SetMode(string? mode) { if (mode is "Processes" or "Startup" or "Power") Mode = mode; }
    [RelayCommand] private void SetSort(string? sort) { if (sort is "CPU" or "Memory") { SortBy = sort; Rebuild(); } }

    public override async Task OnNavigatedToAsync()
    {
        _processes.Reset(); // CPU %s are deltas: start a fresh baseline
        await LoadStartupAsync();
        if (!_settingsLoaded) await LoadSettingsAsync();
        if (_cts is not null) return;
        _cts = new CancellationTokenSource();
        _ = RunAsync(_cts.Token);
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
            using var timer = new PeriodicTimer(TimeSpan.FromSeconds(_appSettings.Current.LiveRefreshSeconds));
            do
            {
                _last = await _processes.SampleAsync(ct);
                Rebuild();
            }
            while (await timer.WaitForNextTickAsync(ct));
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            Log.Error(ex, "Process monitoring stopped");
            ProcessSummary = $"Monitoring stopped: {ex.Message}";
        }
    }

    private void Rebuild()
    {
        if (_last is not { } snap) return;
        var ordered = SortBy == "Memory"
            ? snap.Groups.OrderByDescending(g => g.WorkingSetBytes)
            : snap.Groups.OrderByDescending(g => g.CpuPercent ?? -1).ThenByDescending(g => g.WorkingSetBytes);

        Processes.Clear();
        foreach (var g in ordered.Take(40))
            Processes.Add(new ProcessRow(g.Name, g.Instances.ToString(),
                g.CpuPercent is double c ? $"{c:0.0}%" : (snap.HasCpuBaseline ? "n/a" : "measuring…"),
                $"{g.WorkingSetMb:N0} MB",
                g.IsProtected ? "Windows / security component" : ""));

        ProcessSummary = $"{snap.ProcessCount} processes" +
                         (snap.MemoryPercent is double m ? $" · memory {m:0}% in use" : "") +
                         (snap.HasCpuBaseline ? "" : " · measuring CPU…") +
                         " · CPU is a share of total capacity; “n/a” = Windows denies access to that process.";

        Observations.Clear();
        foreach (var o in PerformanceAnalyzer.Analyze(snap.Groups, snap.MemoryPercent, StartupItems.Count(s => s.IsEnabled)))
            Observations.Add(new ObservationRow(o.Severity == ObservationSeverity.Warning ? "⚠" : "ℹ", o.Title, o.Detail));
    }

    private async Task LoadStartupAsync()
    {
        try
        {
            var entries = await Task.Run(() => _startup.GetEntries());
            StartupItems.Clear();
            foreach (var e in entries) StartupItems.Add(new StartupItemViewModel(e));
            UpdateStartupSummary();
        }
        catch (Exception ex) { Log.Error(ex, "Loading startup entries failed"); StartupSummary = $"Could not read startup entries: {ex.Message}"; }
    }

    private void UpdateStartupSummary()
    {
        int on = StartupItems.Count(s => s.IsEnabled);
        StartupSummary = $"{on} enabled, {StartupItems.Count - on} disabled. OPTIVEX can't measure each program's startup impact, so judge by what you recognise.";
    }

    private async Task LoadSettingsAsync()
    {
        try
        {
            var plan = await _settings.ReadPowerPlanAsync();
            PowerName = plan.Name ?? (plan.Id?.ToString() ?? "Unknown");
            PowerAdviceText = PowerAdvice.ForPlan(plan);
            VisualAdviceText = PowerAdvice.ForVisualEffects(_settings.ReadVisualEffects());
            _settingsLoaded = true;
        }
        catch (Exception ex) { Log.Error(ex, "Loading power settings failed"); PowerAdviceText = $"Could not read settings: {ex.Message}"; }
    }

    [RelayCommand]
    private void ToggleStartup(StartupItemViewModel? item)
    {
        if (item is null) return;
        if (!item.CanToggle)
        {
            _dialogs.Info("Protected item", "Windows security components are protected. OPTIVEX will not disable them.");
            return;
        }

        bool enable = !item.IsEnabled;
        var message = enable
            ? $"Enable “{item.Name}” at startup?\n\nIt will start automatically the next time you sign in."
            : $"Disable “{item.Name}” at startup?\n\nIt will no longer start automatically when you sign in. This does not uninstall it or close it if it is running now.\n" +
              "You can turn it back on here, or in Task Manager → Startup apps.\n\nOnly disable programs you recognise and don't need at sign-in.";
        if (!_dialogs.Confirm(enable ? "Enable startup entry" : "Disable startup entry", message)) return;

        try
        {
            _startup.SetEnabled(item.Entry, enable);
            item.IsEnabled = enable;
            _history.RecordOptimization(enable ? "Startup entry enabled" : "Startup entry disabled", item.Name, item.Source);
            UpdateStartupSummary();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Changing startup entry {Name} failed", item.Name);
            _dialogs.Error("Could not change startup entry", ex.Message);
        }
    }
}
