using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using OPTIVEX.App.Services;
using Serilog;

namespace OPTIVEX.App.ViewModels;

public partial class MainViewModel : ObservableObject
{
    public MainViewModel(IEnumerable<PageViewModel> pages, NavigationService navigation)
    {
        Pages = pages.ToList();
        navigation.Attach(NavigateToTitle); // lets pages open other pages (for example from a recommendation)
        VersionText = $"v{AppInfo.Version}";
        PrivilegeText = AppInfo.IsAdministrator ? "Administrator" : "Standard user";
        PrivilegeTip = AppInfo.IsAdministrator
            ? "OPTIVEX is running as administrator, so more sensors may be available. It never elevates itself."
            : "OPTIVEX is running as a standard user, which is the safest way to use it. CPU temperature may be unavailable on some PCs. OPTIVEX never elevates itself.";
    }

    public IReadOnlyList<PageViewModel> Pages { get; }
    public string VersionText { get; }
    public string PrivilegeText { get; }
    public string PrivilegeTip { get; }

    [ObservableProperty] private PageViewModel? _currentPage;

    /// <summary>True when the window is narrow: the sidebar shows icons only.</summary>
    [ObservableProperty] private bool _isCompactSidebar;

    public void Initialize() => CurrentPage = Pages.FirstOrDefault();

    /// <summary>Ctrl+1 to Ctrl+9 jump to the page at that position in the sidebar.</summary>
    [RelayCommand]
    private void NavigateToIndex(string? index)
    {
        if (int.TryParse(index, out var i) && i >= 0 && i < Pages.Count) CurrentPage = Pages[i];
    }

    private void NavigateToTitle(string title)
    {
        var page = Pages.FirstOrDefault(p => p.Title.Equals(title, StringComparison.OrdinalIgnoreCase));
        if (page is null) Log.Warning("Navigation target {Title} does not exist", title);
        else CurrentPage = page;
    }

    private PageViewModel? _previousPage;

    partial void OnCurrentPageChanged(PageViewModel? value)
    {
        try { _previousPage?.OnNavigatedFrom(); }
        catch (Exception ex) { Log.Error(ex, "Leaving {Page} failed", _previousPage?.Title); }
        _previousPage = value;
        if (value is not null) _ = NavigateAsync(value);
    }

    private static async Task NavigateAsync(PageViewModel page)
    {
        try { await page.OnNavigatedToAsync(); }
        catch (Exception ex) { Log.Error(ex, "Navigation to {Page} failed", page.Title); }
    }
}
