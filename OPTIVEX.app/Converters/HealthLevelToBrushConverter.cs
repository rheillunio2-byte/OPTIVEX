using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;
using OPTIVEX.Core.Health;

namespace OPTIVEX.App.Converters;

/// <summary>Maps a HealthLevel to a status colour (green / amber / red / muted grey for unknown).</summary>
public sealed class HealthLevelToBrushConverter : IValueConverter
{
    private static SolidColorBrush Frozen(string hex)
    {
        var b = (SolidColorBrush)new BrushConverter().ConvertFromString(hex)!;
        b.Freeze();
        return b;
    }

    private static readonly SolidColorBrush Normal = Frozen("#3DDC97"), Elevated = Frozen("#F5B942"),
        High = Frozen("#FF5C5C"), Unknown = Frozen("#9AA8BB");

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture) => value switch
    {
        HealthLevel.Normal => Normal,
        HealthLevel.Elevated => Elevated,
        HealthLevel.High => High,
        _ => Unknown
    };

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
