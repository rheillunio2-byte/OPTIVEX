using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OPTIVEX.App.Services;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Models;
using Serilog;

namespace OPTIVEX.App.ViewModels;

/// <summary>Large-file analyzer. Read-only: the only actions are scan, cancel and "show in folder".</summary>
public partial class LargeFilesViewModel : ObservableObject
{
    private const int MaxResults = 100;
    private readonly ILargeFileAnalyzer _analyzer;
    private readonly IShellService _shell;
    private CancellationTokenSource? _cts;

    public LargeFilesViewModel(ILargeFileAnalyzer analyzer, IShellService shell)
    {
        _analyzer = analyzer;
        _shell = shell;
        Scopes = analyzer.GetScopes();
    }

    public IReadOnlyList<ScanScope> Scopes { get; }
    public ObservableCollection<LargeFile> Items { get; } = new();
    public bool HasItems => Items.Count > 0;

    [ObservableProperty] private string _minSizeMbText = "500";
    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private string _statusText = "Choose where to look. OPTIVEX only lists files; it never deletes them.";

    [RelayCommand]
    private async Task ScanAsync(ScanScope? scope)
    {
        if (scope is null) return;
        if (!long.TryParse(MinSizeMbText.Trim(), out var mb) || mb < 10 || mb > 1_000_000)
        {
            StatusText = "Enter a minimum size between 10 and 1,000,000 MB.";
            return;
        }

        _cts = new CancellationTokenSource();
        IsBusy = true;
        StatusText = $"Scanning {scope.DisplayName}… this can take several minutes on a large drive.";
        var progress = new Progress<long>(n => StatusText = $"Scanning {scope.DisplayName}… {n:N0} files checked");
        try
        {
            var r = await _analyzer.FindAsync(scope, mb * 1024 * 1024, MaxResults, progress, _cts.Token);
            Items.Clear();
            foreach (var f in r.Files) Items.Add(f);
            OnPropertyChanged(nameof(HasItems));
            StatusText = (r.Cancelled ? "Stopped early. Showing partial results: " : "Done: ") +
                         $"{r.Files.Count} file(s) of {mb:N0} MB or more among {r.FilesScanned:N0} files checked" +
                         (r.Inaccessible > 0 ? $" ({r.Inaccessible} folders/files could not be read)." : ".");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Large-file scan failed");
            StatusText = $"Scan failed: {ex.Message}";
        }
        finally
        {
            IsBusy = false;
            _cts?.Dispose();
            _cts = null;
        }
    }

    [RelayCommand]
    private void Cancel() => _cts?.Cancel();

    [RelayCommand]
    private void Reveal(LargeFile? file)
    {
        if (file is not null) _shell.RevealInExplorer(file.FullPath);
    }
}
