using System.Collections.ObjectModel;
using System.ComponentModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OPTIVEX.App.Services;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Formatting;
using OPTIVEX.Core.Models;
using OPTIVEX.Core.Safety;
using Serilog;

namespace OPTIVEX.App.ViewModels;

public partial class CleanupItemViewModel : ObservableObject
{
    public CleanupItemViewModel(CleanupCandidate candidate) => Candidate = candidate;
    public CleanupCandidate Candidate { get; }
    public string Name => Candidate.DisplayName;
    public string Location => System.IO.Path.GetDirectoryName(Candidate.FullPath) ?? "";
    public string Category => Candidate.Category;
    public long SizeBytes => Candidate.SizeBytes;
    public string SizeLabel => Candidate.SizeLabel;
    public DateTime LastModified => Candidate.LastModified;

    /// <summary>Nothing is selected by default: deletion is always an explicit choice.</summary>
    [ObservableProperty] private bool _isSelected;
}

public partial class CategoryViewModel : ObservableObject
{
    private readonly Action<CategoryViewModel, bool> _onToggle;
    private bool _silent;

    public CategoryViewModel(string name, int count, long bytes, Action<CategoryViewModel, bool> onToggle)
    {
        Name = name; Count = count; Bytes = bytes; _onToggle = onToggle;
    }

    public string Name { get; }
    public int Count { get; }
    public long Bytes { get; }
    public string Description => CleanupPolicy.Describe(Name);
    public string Label => $"{Name} · {Count:N0} files · {ByteFormat.Format(Bytes)}";

    [ObservableProperty] private bool _isSelected;

    partial void OnIsSelectedChanged(bool value)
    {
        if (!_silent) _onToggle(this, value);
    }

    public void SetSilently(bool value)
    {
        _silent = true;
        IsSelected = value;
        _silent = false;
    }
}

public partial class StorageCleanerViewModel : PageViewModel
{
    private readonly IStorageScanner _scanner;
    private readonly IDialogService _dialogs;
    private readonly IHistoryRecorder _history;
    private bool _bulk; // suppress per-item recalculation while many items change at once

    public StorageCleanerViewModel(IStorageScanner scanner, IDialogService dialogs, LargeFilesViewModel largeFiles, IHistoryRecorder history)
        : base("Storage Cleaner", "Review eligible temporary files and caches before any deletion. Personal folders are never scanned.", "▤")
    {
        _scanner = scanner;
        _dialogs = dialogs;
        _history = history;
        LargeFiles = largeFiles;
    }

    public LargeFilesViewModel LargeFiles { get; }
    public ObservableCollection<CleanupItemViewModel> Items { get; } = new();
    public ObservableCollection<CategoryViewModel> Categories { get; } = new();
    public bool HasItems => Items.Count > 0;

    [ObservableProperty] private string _mode = "Cleanup";
    [ObservableProperty] private bool _isBusy;
    [ObservableProperty] private string _statusText = "Click “Scan” to begin. Nothing is deleted without your confirmation.";
    [ObservableProperty] private string _totalText = "";
    [ObservableProperty] private string _selectedText = "No files selected";

    [RelayCommand]
    private void SetMode(string? mode)
    {
        if (mode is "Cleanup" or "LargeFiles") Mode = mode;
    }

    partial void OnIsBusyChanged(bool value) => CleanCommand.NotifyCanExecuteChanged();

    private bool CanClean() => !IsBusy && Items.Any(i => i.IsSelected);

    private void OnItemChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (!_bulk && e.PropertyName == nameof(CleanupItemViewModel.IsSelected)) RefreshSelection();
    }

    private void RefreshSelection()
    {
        var sel = Items.Where(i => i.IsSelected).ToList();
        SelectedText = sel.Count == 0 ? "No files selected" : $"{sel.Count:N0} selected · {ByteFormat.Format(sel.Sum(i => i.SizeBytes))}";
        foreach (var c in Categories)
            c.SetSilently(Items.Any(i => i.Category == c.Name) && Items.Where(i => i.Category == c.Name).All(i => i.IsSelected));
        CleanCommand.NotifyCanExecuteChanged();
    }

    private void SetMany(Func<CleanupItemViewModel, bool> filter, bool value)
    {
        _bulk = true;
        try { foreach (var i in Items.Where(filter)) i.IsSelected = value; }
        finally { _bulk = false; }
        RefreshSelection();
    }

    private void OnCategoryToggled(CategoryViewModel category, bool value) => SetMany(i => i.Category == category.Name, value);

    [RelayCommand]
    private async Task ScanAsync()
    {
        IsBusy = true;
        StatusText = "Scanning approved temporary and cache locations…";
        try
        {
            var result = await _scanner.ScanAsync();
            _history.RecordStorageScan(result);
            foreach (var old in Items) old.PropertyChanged -= OnItemChanged;
            Items.Clear();
            Categories.Clear();
            foreach (var c in result.Candidates)
            {
                var vm = new CleanupItemViewModel(c);
                vm.PropertyChanged += OnItemChanged;
                Items.Add(vm);
            }
            foreach (var g in result.Candidates.GroupBy(c => c.Category).OrderByDescending(g => g.Sum(x => x.SizeBytes)))
                Categories.Add(new CategoryViewModel(g.Key, g.Count(), g.Sum(x => x.SizeBytes), OnCategoryToggled));

            OnPropertyChanged(nameof(HasItems));
            TotalText = $"{result.Candidates.Count:N0} files · {ByteFormat.Format(result.Candidates.Sum(f => f.SizeBytes))} recoverable (estimate)";
            StatusText = result.Candidates.Count == 0
                ? "No eligible files found."
                : "Scan complete. Tick categories or individual files to remove.";
            if (result.Truncated) StatusText += " The list was capped, so the real total is larger; clean this batch and scan again.";
            RefreshSelection();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Storage scan failed");
            StatusText = $"Scan failed: {ex.Message}";
        }
        finally { IsBusy = false; }
    }

    [RelayCommand] private void SelectAll() => SetMany(_ => true, true);
    [RelayCommand] private void SelectNone() => SetMany(_ => true, false);

    [RelayCommand(CanExecute = nameof(CanClean))]
    private async Task CleanAsync()
    {
        var selected = Items.Where(i => i.IsSelected).ToList();
        if (selected.Count == 0) return;

        long total = selected.Sum(i => i.SizeBytes);
        var byCategory = string.Join("\n", selected.GroupBy(i => i.Category)
            .Select(g => $"• {g.Key}: {g.Count():N0} file(s), {ByteFormat.Format(g.Sum(i => i.SizeBytes))}"));
        var largest = string.Join("\n", selected.OrderByDescending(i => i.SizeBytes).Take(10).Select(i => $"   {i.Name}  ({i.SizeLabel})"));
        var message = $"You are about to permanently delete {selected.Count:N0} file(s) ({ByteFormat.Format(total)}):\n\n{byCategory}\n\n" +
                      $"Largest items:\n{largest}\n\n" +
                      "Deleted files do not go to the Recycle Bin. Files in use will be skipped.\n\nContinue?";
        if (!_dialogs.Confirm("Confirm cleanup", message))
        {
            Log.Information("Cleanup cancelled by user ({Count} files were selected)", selected.Count);
            return;
        }

        CleanupResult? result = null;
        IsBusy = true;
        try { result = await _scanner.CleanSelectedAsync(selected.Select(i => i.Candidate)); }
        catch (Exception ex)
        {
            Log.Error(ex, "Cleanup failed");
            _dialogs.Error("Cleanup failed", ex.Message);
        }
        finally { IsBusy = false; }

        if (result is not null) _history.RecordCleanup(result, selected.Count);
        if (result is not null)
            _dialogs.Info("Cleanup complete",
                $"Deleted {result.Deleted:N0} file(s) and recovered {ByteFormat.Format(result.Bytes)}.\nSkipped {result.Skipped:N0} (in use, protected, changed since the scan, or no permission).");
        await ScanAsync();
    }
}
