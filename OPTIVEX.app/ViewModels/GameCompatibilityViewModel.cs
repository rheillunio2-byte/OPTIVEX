using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Gaming;
using OPTIVEX.Core.Health;
using OPTIVEX.Core.Models;
using OPTIVEX.Core.Services;
using Serilog;

namespace OPTIVEX.App.ViewModels;

public sealed record RequirementRow(string Label, string Minimum, string Recommended);
public sealed record CheckRow(string Icon, string Component, string Detail);

public partial class GameCompatibilityViewModel : PageViewModel
{
    private readonly GameCatalog _catalog;
    private readonly IHardwareScanner _scanner;
    private readonly CompatibilityService _service = new();
    private HardwareProfile? _hardware;

    public GameCompatibilityViewModel(GameCatalog catalog, IHardwareScanner scanner)
        : base("Game Compatibility", "Compare your PC with a game's published requirements. Compatibility is not a performance prediction.", "✔")
    {
        _catalog = catalog;
        _scanner = scanner;
        _catalog.Changed += (_, _) => RefreshResults();
        RefreshResults();
    }

    public ObservableCollection<GameRequirement> Results { get; } = new();
    public ObservableCollection<RequirementRow> Requirements { get; } = new();
    public ObservableCollection<CheckRow> Checks { get; } = new();
    public ObservableCollection<string> Limitations { get; } = new();

    [ObservableProperty] private string _query = "";
    [ObservableProperty] private GameRequirement? _selectedGame;
    [ObservableProperty] private bool _hasSelection;
    [ObservableProperty] private string _cpuLevel = "NotSure";
    [ObservableProperty] private string _gpuLevel = "NotSure";
    [ObservableProperty] private string _hardwareText = "Detecting hardware…";
    [ObservableProperty] private string _verdictText = "";
    [ObservableProperty] private HealthLevel _verdictLevel;
    [ObservableProperty] private string _originText = "";
    [ObservableProperty] private string _sourceText = "";
    [ObservableProperty] private string _verifiedText = "";
    [ObservableProperty] private string _notesText = "";
    [ObservableProperty] private string _resultCountText = "";

    public override async Task OnNavigatedToAsync()
    {
        try
        {
            _hardware = HardwareProfileBuilder.From(await _scanner.ScanAsync());
            HardwareText = $"{_hardware.Cpu} · {_hardware.Gpu} · {_hardware.RamGb:0.#} GB RAM · " +
                           (_hardware.FreeStorageDrive is null ? "free space unavailable" : $"{_hardware.FreeStorageGb:0} GB free on {_hardware.FreeStorageDrive}");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Hardware detection failed for compatibility check");
            HardwareText = "Hardware detection failed: " + ex.Message;
        }
        Recompute();
    }

    partial void OnQueryChanged(string value) => RefreshResults();
    partial void OnSelectedGameChanged(GameRequirement? value) => Recompute();

    [RelayCommand] private void SetCpuLevel(string? level) { if (level is not null) { CpuLevel = level; Recompute(); } }
    [RelayCommand] private void SetGpuLevel(string? level) { if (level is not null) { GpuLevel = level; Recompute(); } }

    private void RefreshResults()
    {
        var keep = SelectedGame?.Id;
        var found = _catalog.Search(Query);
        Results.Clear();
        foreach (var g in found) Results.Add(g);
        ResultCountText = _catalog.CatalogLoaded
            ? $"{found.Count} game(s)"
            : $"{found.Count} game(s). The bundled catalog file could not be loaded, so only games you added are listed.";
        SelectedGame = Results.FirstOrDefault(g => g.Id == keep);
    }

    private static ManualLevel Map(string level) => level switch
    {
        "Below" => ManualLevel.BelowMinimum,
        "Min" => ManualLevel.MeetsMinimum,
        "Rec" => ManualLevel.MeetsRecommended,
        _ => ManualLevel.NotSure
    };

    private static string Ram(RequirementTier t) => t.RamGb is int r
        ? $"{r} GB" + (t.RamGbIntegratedGpu is int i ? $" ({i} GB with integrated graphics)" : "")
        : "Not published";

    private void Recompute()
    {
        Requirements.Clear(); Checks.Clear(); Limitations.Clear();
        if (SelectedGame is not { } g) { HasSelection = false; return; }
        HasSelection = true;

        string P(string? text) => string.IsNullOrWhiteSpace(text) ? "Not published" : text;
        Requirements.Add(new("Windows", P(g.Minimum.Os), P(g.Recommended.Os)));
        Requirements.Add(new("Processor", P(g.Minimum.Cpu), P(g.Recommended.Cpu)));
        Requirements.Add(new("Graphics", P(g.Minimum.Gpu), P(g.Recommended.Gpu)));
        Requirements.Add(new("Memory", Ram(g.Minimum), Ram(g.Recommended)));
        Requirements.Add(new("Storage", g.StorageGb is int gb ? $"{gb} GB" : "Not published", "—"));

        OriginText = g.OriginLabel;
        SourceText = g.Source;
        VerifiedText = g.LastVerified is DateOnly d ? $"Last verified {d:yyyy-MM-dd}" : "Not verified by OPTIVEX";
        NotesText = g.Notes ?? "";

        if (_hardware is null) { VerdictText = "Detecting hardware…"; VerdictLevel = HealthLevel.Unknown; return; }

        var r = _service.Compare(g, _hardware, new ManualAssessment(Map(CpuLevel), Map(GpuLevel)));
        VerdictText = Verdicts.Label(r.Verdict);
        VerdictLevel = r.Verdict switch
        {
            CompatibilityVerdict.MeetsRecommended or CompatibilityVerdict.MeetsMinimum => HealthLevel.Normal,
            CompatibilityVerdict.BelowMinimum => HealthLevel.High,
            _ => HealthLevel.Elevated
        };
        foreach (var c in r.Checks)
            Checks.Add(new CheckRow(c.Status switch { CheckStatus.Pass => "✔", CheckStatus.Fail => "✖", CheckStatus.Unverified => "?", _ => "–" }, c.Component, c.Detail));
        foreach (var l in r.Limitations) Limitations.Add(l);
    }
}
