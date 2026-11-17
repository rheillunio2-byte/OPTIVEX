using OPTIVEX.Core.Reporting;
using System.Collections.ObjectModel;
using System.IO;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OPTIVEX.App.Services;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Gaming;
using OPTIVEX.Core.Models;
using Serilog;

namespace OPTIVEX.App.ViewModels;

public sealed record CatalogRow(string Id, string Title, string MinCpu, string MinGpu, string MinRam, string RecCpu, string RecGpu,
    string RecRam, string Storage, string Origin, string Source, string Verified, bool CanRemove);
public sealed record RunningRow(string Name, string Cpu, string Memory);
public sealed record ProfileRow(string Id, string Name, string Program, string Notes, string Status);

/// <summary>Gaming dashboard, profiles, searchable catalog and manual game entry. All data stays local.</summary>
public partial class GamingCenterViewModel : PageViewModel
{
    private readonly IHardwareScanner _scanner;
    private readonly ILiveMetricsProvider _metrics;
    private readonly IProcessMonitor _processes;
    private readonly ISystemSettingsReader _settings;
    private readonly GameCatalog _catalog;
    private readonly IGameStore _store;
    private readonly IDialogService _dialogs;
    private readonly SettingsService _appSettings;
    private List<GameProfile> _profiles = new();
    private HardwareProfile? _hardware;
    private PowerPlanInfo? _plan;
    private CancellationTokenSource? _cts;
    private string _tipKey = "", _runningKey = "";

    public GamingCenterViewModel(IHardwareScanner scanner, ILiveMetricsProvider metrics, IProcessMonitor processes, ISystemSettingsReader settings,
        GameCatalog catalog, IGameStore store, IDialogService dialogs, SettingsService appSettings)
        : base("Gaming Center", "Your gaming hardware, game profiles and a catalog of published requirements. Nothing is invented: unknown values are labelled.", "🎮")
    {
        _scanner = scanner; _metrics = metrics; _processes = processes; _settings = settings; _catalog = catalog; _store = store; _dialogs = dialogs; _appSettings = appSettings;
        _profiles = store.LoadProfiles().ToList();
        _catalog.Changed += (_, _) => RebuildCatalog();
        RebuildCatalog();
        RebuildProfiles(new HashSet<string>());
    }

    public ObservableCollection<ObservationRow> Tips { get; } = new();
    public ObservableCollection<RunningRow> Running { get; } = new();
    public ObservableCollection<ProfileRow> ProfileRows { get; } = new();
    public ObservableCollection<CatalogRow> CatalogRows { get; } = new();

    [ObservableProperty] private string _mode = "Dashboard";
    [ObservableProperty] private string _hardwareText = "Detecting…";
    [ObservableProperty] private string _cpuUseText = "—";
    [ObservableProperty] private string _memUseText = "—";
    [ObservableProperty] private string _cpuTempText = "—";
    [ObservableProperty] private string _cpuTempNote = "";
    [ObservableProperty] private string _gpuTempText = "—";
    [ObservableProperty] private string _gpuTempNote = "";
    [ObservableProperty] private string _gpuLoadText = "—";
    [ObservableProperty] private string _runningSummary = "Add a game profile with its program to see its resource use while it runs.";

    // Profiles form
    [ObservableProperty] private string _newProfileName = "";
    [ObservableProperty] private string _newProfileExe = "";
    [ObservableProperty] private string _newProfileNotes = "";
    [ObservableProperty] private string _profileStatus = "";

    // Catalog
    [ObservableProperty] private string _catalogQuery = "";
    [ObservableProperty] private string _catalogNote = "";

    // Add-a-game form
    [ObservableProperty] private string _newTitle = "";
    [ObservableProperty] private string _newMinCpu = "";
    [ObservableProperty] private string _newMinGpu = "";
    [ObservableProperty] private string _newMinRam = "";
    [ObservableProperty] private string _newRecCpu = "";
    [ObservableProperty] private string _newRecGpu = "";
    [ObservableProperty] private string _newRecRam = "";
    [ObservableProperty] private string _newStorage = "";
    [ObservableProperty] private string _newOs = "";
    [ObservableProperty] private string _newSourceNote = "";
    [ObservableProperty] private string _addStatus = "";

    [RelayCommand] private void SetMode(string? mode) { if (mode is "Dashboard" or "Profiles" or "Catalog" or "AddGame") Mode = mode; }
    partial void OnCatalogQueryChanged(string value) => RebuildCatalog();

    // ---------- navigation / live loop ----------
    public override async Task OnNavigatedToAsync()
    {
        _processes.Reset();
        try
        {
            _hardware = HardwareProfileBuilder.From(await _scanner.ScanAsync());
            HardwareText = $"{_hardware.Cpu}\n{_hardware.Gpu}\n{_hardware.RamGb:0.#} GB RAM · " +
                           (_hardware.FreeStorageDrive is null ? "free space unavailable" : $"{_hardware.FreeStorageGb:0} GB free on {_hardware.FreeStorageDrive}");
            _plan ??= await _settings.ReadPowerPlanAsync();
        }
        catch (Exception ex) { Log.Error(ex, "Gaming Center hardware detection failed"); HardwareText = "Hardware detection failed: " + ex.Message; }

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
                var m = await _metrics.SampleAsync(ct);
                var p = await _processes.SampleAsync(ct);
                Apply(m, p);
            }
            while (await timer.WaitForNextTickAsync(ct));
        }
        catch (OperationCanceledException) { }
        catch (Exception ex) { Log.Error(ex, "Gaming monitoring stopped"); RunningSummary = "Monitoring stopped: " + ex.Message; }
    }

    private void Apply(LiveMetrics m, ProcessSnapshot snap)
    {
        CpuUseText = m.TotalCpuPercent.Value is double c ? $"{c:0}%" : "Unavailable";
        MemUseText = m.MemoryPercent is double mp ? $"{mp:0}%" : "Unavailable";
        (CpuTempText, CpuTempNote) = m.CpuTempC.Value is double ct ? ($"{ct:0}°C", "") : ("Unavailable", m.CpuTempC.Reason ?? "");
        (GpuTempText, GpuTempNote) = m.GpuTempC.Value is double gt ? ($"{gt:0}°C", "") : ("Unavailable", m.GpuTempC.Reason ?? "");
        GpuLoadText = m.GpuLoadPercent.Value is double gl ? $"{gl:0}%" : "Unavailable";

        // Match profiles to running programs by executable name.
        var runningIds = new HashSet<string>();
        var rows = new List<RunningRow>();
        foreach (var prof in _profiles.Where(x => !string.IsNullOrWhiteSpace(x.ExePath)))
        {
            var exeName = Path.GetFileNameWithoutExtension(prof.ExePath!);
            var group = snap.Groups.FirstOrDefault(g => g.Name.Equals(exeName, StringComparison.OrdinalIgnoreCase));
            if (group is null) continue;
            runningIds.Add(prof.Id);
            rows.Add(new RunningRow(prof.Name, group.CpuPercent is double gc ? $"{gc:0.0}% of total CPU" : "measuring…", $"{group.WorkingSetMb:N0} MB"));
        }

        var key = string.Join("|", rows.Select(r => r.Name));
        if (key != _runningKey || rows.Count > 0) // refresh values while a game runs
        {
            Running.Clear();
            foreach (var r in rows) Running.Add(r);
            if (key != _runningKey) RebuildProfiles(runningIds);
            _runningKey = key;
        }
        RunningSummary = rows.Count > 0 ? $"{rows.Count} profile game(s) running. System CPU {CpuUseText}, memory {MemUseText}."
            : _profiles.Count == 0 ? "Add a game profile with its program to see its resource use while it runs."
            : "No profile game is running. Games started through a launcher may use a different program name.";

        if (_hardware is not null)
        {
            var tips = GamingAdvisor.Advise(_hardware, _plan, m.CpuTempC.Value, m.GpuTempC.Value);
            var tipKey = string.Join("|", tips.Select(t => t.Title));
            if (tipKey != _tipKey)
            {
                _tipKey = tipKey;
                Tips.Clear();
                foreach (var t in tips) Tips.Add(new ObservationRow(t.Severity == ObservationSeverity.Warning ? "⚠" : "ℹ", t.Title, t.Detail));
            }
        }
    }

    // ---------- profiles ----------
    private void RebuildProfiles(HashSet<string> runningIds)
    {
        ProfileRows.Clear();
        foreach (var p in _profiles)
            ProfileRows.Add(new ProfileRow(p.Id, p.Name, p.ExePath ?? "—", p.Notes ?? "", runningIds.Contains(p.Id) ? "Running" : p.ExePath is null ? "No program set" : "Not running"));
    }

    [RelayCommand]
    private void BrowseProgram()
    {
        var path = _dialogs.PickExecutable();
        if (path is not null) NewProfileExe = path;
    }

    [RelayCommand]
    private void AddProfile()
    {
        var errors = GameValidator.ValidateProfile(NewProfileName, NewProfileExe, File.Exists).ToList();
        if (_profiles.Any(p => p.Name.Equals(NewProfileName.Trim(), StringComparison.OrdinalIgnoreCase))) errors.Add("A profile with this name already exists.");
        if (errors.Count > 0) { ProfileStatus = string.Join("\n", errors); return; }

        _profiles.Add(new GameProfile(Guid.NewGuid().ToString("N")[..8], NewProfileName.Trim(),
            string.IsNullOrWhiteSpace(NewProfileExe) ? null : NewProfileExe.Trim(),
            string.IsNullOrWhiteSpace(NewProfileNotes) ? null : NewProfileNotes.Trim()));
        if (!TrySaveProfiles()) { _profiles.RemoveAt(_profiles.Count - 1); return; }
        NewProfileName = NewProfileExe = NewProfileNotes = "";
        ProfileStatus = "Profile added.";
        _runningKey = "\0"; // force a refresh of running state on the next sample
        RebuildProfiles(new HashSet<string>());
    }

    [RelayCommand]
    private void RemoveProfile(ProfileRow? row)
    {
        if (row is null) return;
        if (!_dialogs.Confirm("Remove profile", $"Remove the profile “{row.Name}”?\n\nThis only removes OPTIVEX's record. The game itself is not touched.")) return;
        _profiles.RemoveAll(p => p.Id == row.Id);
        TrySaveProfiles();
        _runningKey = "\0";
        RebuildProfiles(new HashSet<string>());
    }

    private bool TrySaveProfiles()
    {
        try { _store.SaveProfiles(_profiles); return true; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Log.Error(ex, "Saving profiles failed");
            ProfileStatus = "Could not save profiles: " + ex.Message;
            return false;
        }
    }

    // ---------- catalog ----------
    private void RebuildCatalog()
    {
        CatalogRows.Clear();
        var games = _catalog.Search(CatalogQuery);
        foreach (var g in games)
        {
            string R(RequirementTier t) => t.RamGb is int r ? $"{r} GB" + (t.RamGbIntegratedGpu is int i ? $" ({i} with iGPU)" : "") : "—";
            CatalogRows.Add(new CatalogRow(g.Id, g.Title, g.Minimum.Cpu ?? "—", g.Minimum.Gpu ?? "—", R(g.Minimum), g.Recommended.Cpu ?? "—", g.Recommended.Gpu ?? "—",
                R(g.Recommended), g.StorageGb is int s ? $"{s} GB" : "—", g.OriginLabel, g.Source,
                g.LastVerified is DateOnly d ? d.ToString("yyyy-MM-dd") : "Not verified", g.IsUserProvided));
        }
        int user = _catalog.All.Count(g => g.IsUserProvided);
        CatalogNote = $"{games.Count} of {_catalog.All.Count} games ({user} user-provided). “—” means the source does not publish that figure. User-provided entries are not verified by OPTIVEX.";
    }

    [RelayCommand]
    private void RemoveGame(CatalogRow? row)
    {
        if (row is null || !row.CanRemove) return;
        if (!_dialogs.Confirm("Remove game", $"Remove your entry for “{row.Title}”?")) return;
        _catalog.RemoveUserGame(row.Id);
    }

    // ---------- add a game ----------
    private static bool TryOptionalInt(string text, out int? value)
    {
        value = null;
        if (string.IsNullOrWhiteSpace(text)) return true;
        if (!int.TryParse(text.Trim(), out var v)) return false;
        value = v;
        return true;
    }

    private static string? Blank(string s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    [RelayCommand]
    private void AddGame()
    {
        if (!TryOptionalInt(NewMinRam, out var minRam) || !TryOptionalInt(NewRecRam, out var recRam) || !TryOptionalInt(NewStorage, out var storage))
        { AddStatus = "RAM and storage must be whole numbers of GB (or left blank)."; return; }

        var draft = new GameRequirement("", NewTitle ?? "",
            new RequirementTier(Blank(NewMinCpu), Blank(NewMinGpu), minRam, Blank(NewOs)),
            new RequirementTier(Blank(NewRecCpu), Blank(NewRecGpu), recRam, null),
            storage, SourceKind.UserProvided, NewSourceNote ?? "", null);

        try
        {
            var (ok, errors) = _catalog.AddUserGame(draft);
            if (!ok) { AddStatus = string.Join("\n", errors); return; }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Log.Error(ex, "Saving user game failed");
            AddStatus = "Could not save: " + ex.Message;
            return;
        }
        Log.Information("User added game {Title}", NewTitle);
        NewTitle = NewMinCpu = NewMinGpu = NewMinRam = NewRecCpu = NewRecGpu = NewRecRam = NewStorage = NewOs = NewSourceNote = "";
        AddStatus = "Added as user-provided. It now appears in the catalog and in Game Compatibility.";
        Mode = "Catalog";
    }
}
