using System.Windows;
using System.Windows.Controls;
using OPTIVEX.Core.Layout;

namespace OPTIVEX.App.Controls;

/// <summary>
/// A responsive card grid. It picks the number of columns from the available width (each card at least
/// <see cref="MinItemWidth"/> wide) and balances the rows, so cards reflow when the window is resized instead of
/// being squashed. The column maths lives in Core (<see cref="AdaptiveLayout"/>) where it is unit-tested.
/// </summary>
public sealed class AdaptivePanel : Panel
{
    public static readonly DependencyProperty MinItemWidthProperty = DependencyProperty.Register(
        nameof(MinItemWidth), typeof(double), typeof(AdaptivePanel),
        new FrameworkPropertyMetadata(200d, FrameworkPropertyMetadataOptions.AffectsMeasure | FrameworkPropertyMetadataOptions.AffectsArrange));

    public double MinItemWidth
    {
        get => (double)GetValue(MinItemWidthProperty);
        set => SetValue(MinItemWidthProperty, value);
    }

    private List<UIElement> VisibleChildren() =>
        InternalChildren.Cast<UIElement>().Where(c => c.Visibility != Visibility.Collapsed).ToList();

    protected override Size MeasureOverride(Size available)
    {
        var items = VisibleChildren();
        if (items.Count == 0) return new Size(0, 0);

        double width = double.IsInfinity(available.Width) ? MinItemWidth * items.Count : available.Width;
        int cols = AdaptiveLayout.Columns(width, MinItemWidth, items.Count);
        double itemWidth = width / cols;

        double totalHeight = 0;
        for (int row = 0; row < items.Count; row += cols)
        {
            double rowHeight = 0;
            for (int i = row; i < Math.Min(row + cols, items.Count); i++)
            {
                items[i].Measure(new Size(itemWidth, double.PositiveInfinity));
                rowHeight = Math.Max(rowHeight, items[i].DesiredSize.Height);
            }
            totalHeight += rowHeight;
        }
        return new Size(width, totalHeight);
    }

    protected override Size ArrangeOverride(Size finalSize)
    {
        var items = VisibleChildren();
        if (items.Count == 0) return finalSize;

        int cols = AdaptiveLayout.Columns(finalSize.Width, MinItemWidth, items.Count);
        double itemWidth = finalSize.Width / cols;

        double y = 0;
        for (int row = 0; row < items.Count; row += cols)
        {
            double rowHeight = 0;
            for (int i = row; i < Math.Min(row + cols, items.Count); i++)
            {
                items[i].Measure(new Size(itemWidth, double.PositiveInfinity)); // width may differ from the measure pass
                rowHeight = Math.Max(rowHeight, items[i].DesiredSize.Height);
            }
            for (int i = row; i < Math.Min(row + cols, items.Count); i++)
                items[i].Arrange(new Rect((i - row) * itemWidth, y, itemWidth, rowHeight));
            y += rowHeight;
        }
        return new Size(finalSize.Width, y);
    }
}
