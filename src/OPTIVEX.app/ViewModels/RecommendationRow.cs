using System.Windows.Input;
using CommunityToolkit.Mvvm.Input;
using OPTIVEX.App.Services;
using OPTIVEX.Core.Health;
using OPTIVEX.Core.Intelligence;
using OPTIVEX.Core.Models;

namespace OPTIVEX.App.ViewModels;

/// <summary>Display form of a recommendation: the six spec fields in plain words, plus a button that opens the page where you can act on it.</summary>
public sealed record RecommendationRow(string Category, string Priority, HealthLevel Level, string Issue,
    string Explanation, string Benefit, string Risk, string Action, string Reversible, string GoLabel, ICommand Go)
{
    public static RecommendationRow From(Recommendation r, NavigationService nav)
    {
        var page = RecommendationNavigation.PageFor(r.Category);
        return new(
            r.Category switch
            {
                RecommendationCategory.Memory => "MEMORY",
                RecommendationCategory.Storage => "STORAGE",
                RecommendationCategory.Startup => "STARTUP",
                RecommendationCategory.Processes => "PROGRAMS",
                RecommendationCategory.Thermal => "TEMPERATURE",
                RecommendationCategory.Battery => "BATTERY",
                RecommendationCategory.Power => "POWER PLAN",
                _ => "VISUAL EFFECTS"
            },
            r.Priority switch { RecommendationPriority.High => "HIGH PRIORITY", RecommendationPriority.Medium => "MEDIUM PRIORITY", _ => "LOW PRIORITY" },
            r.Priority switch { RecommendationPriority.High => HealthLevel.High, RecommendationPriority.Medium => HealthLevel.Elevated, _ => HealthLevel.Unknown },
            r.Issue, r.Explanation, r.PotentialBenefit,
            r.Risk switch { RiskLevel.Low => "Low", RiskLevel.Medium => "Medium", _ => "High" },
            r.RecommendedAction,
            r.Reversible switch
            {
                Reversibility.Yes => "Yes, you can undo it",
                Reversibility.No => "No, it cannot be undone",
                _ => "Advice only: OPTIVEX changes nothing"
            },
            $"Open {page}",
            new RelayCommand(() => nav.NavigateTo(page)));
    }
}
