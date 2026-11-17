using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;

namespace OPTIVEX.App.Converters;

/// <summary>Highlights the active mode button: accent blue when the bound mode equals the parameter.</summary>
public sealed class ModeToBrushConverter : IValueConverter
{
    private static readonly Brush Active = Make("#2D6FE8"), Inactive = Make("#202D43");
    private static Brush Make(string hex) { var b = (SolidColorBrush)new BrushConverter().ConvertFromString(hex)!; b.Freeze(); return b; }

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture) =>
        string.Equals(value as string, parameter as string, StringComparison.Ordinal) ? Active : Inactive;

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture) =>
        throw new NotSupportedException();
}
