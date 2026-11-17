using System.Globalization;
using System.Windows;
using System.Windows.Data;
using System.Windows.Media;

namespace OPTIVEX.App.Converters;

/// <summary>Maps a page title to its vector icon from Theme.xaml, so icons render the same on every PC (no icon font needed).</summary>
public sealed class PageIconConverter : IValueConverter
{
    private static string KeyFor(string title) => title switch
    {
        "Overview" => "Icon.Overview",
        "System Health" => "Icon.Health",
        "Storage Cleaner" => "Icon.Storage",
        "Performance" => "Icon.Performance",
        "Gaming Center" => "Icon.Gaming",
        "Game Compatibility" => "Icon.Compatibility",
        "Laptop Care" => "Icon.Laptop",
        "Reports" => "Icon.Reports",
        "Settings" => "Icon.Settings",
        _ => ""
    };

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture) =>
        value is string title && KeyFor(title) is { Length: > 0 } key && Application.Current?.TryFindResource(key) is Geometry g ? g : Geometry.Empty;

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) => throw new NotSupportedException();
}
