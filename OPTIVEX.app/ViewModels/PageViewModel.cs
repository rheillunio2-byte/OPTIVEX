using CommunityToolkit.Mvvm.ComponentModel;

namespace OPTIVEX.App.ViewModels;

public abstract partial class PageViewModel : ObservableObject
{
    protected PageViewModel(string title, string subtitle, string icon)
    {
        Title = title;
        _subtitle = subtitle;
        Icon = icon;
    }

    public string Title { get; }
    public string Icon { get; }

    [ObservableProperty] private string _subtitle;

    /// <summary>Called each time the user navigates to the page.</summary>
    public virtual Task OnNavigatedToAsync() => Task.CompletedTask;

    /// <summary>Called when the user leaves the page (stop timers, background work).</summary>
    public virtual void OnNavigatedFrom() { }
}
