using OPTIVEX.Core.Models;

namespace OPTIVEX.Core.Intelligence;

/// <summary>Which page of the app is the right place to act on a recommendation. OPTIVEX only opens the page; it never applies the change.</summary>
public static class RecommendationNavigation
{
    public static string PageFor(RecommendationCategory category) => category switch
    {
        RecommendationCategory.Storage => "Storage Cleaner",
        RecommendationCategory.Thermal => "System Health",
        RecommendationCategory.Battery => "Laptop Care",
        _ => "Performance" // memory, startup, programs, power plan, visual effects
    };
}
