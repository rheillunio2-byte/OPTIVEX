namespace OPTIVEX.App.Services;

/// <summary>
/// Lets any page ask the shell to open another page by title. It holds a callback instead of the shell itself
/// so pages and the shell do not depend on each other (which would be a circular dependency).
/// </summary>
public sealed class NavigationService
{
    private Action<string>? _navigate;

    public void Attach(Action<string> navigate) => _navigate = navigate;
    public void NavigateTo(string pageTitle) => _navigate?.Invoke(pageTitle);
}
