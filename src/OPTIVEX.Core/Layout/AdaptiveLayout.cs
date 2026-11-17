namespace OPTIVEX.Core.Layout;

/// <summary>Column maths for the responsive card panel, kept here so it can be unit-tested without WPF.</summary>
public static class AdaptiveLayout
{
    /// <summary>
    /// How many columns to use for <paramref name="itemCount"/> cards of at least <paramref name="minItemWidth"/> in
    /// <paramref name="availableWidth"/>. Prefers a column count that fills rows evenly (6 cards → 3+3, not 4+2) and
    /// never leaves a lone card on the last row when a better split exists.
    /// </summary>
    public static int Columns(double availableWidth, double minItemWidth, int itemCount)
    {
        if (itemCount <= 1) return 1;
        if (minItemWidth <= 0 || double.IsNaN(availableWidth) || availableWidth <= 0) return 1;

        int max = Math.Clamp((int)Math.Floor(availableWidth / minItemWidth), 1, itemCount);
        if (max == 1) return 1;

        for (int c = max; c > 1; c--)            // 1) an even split
            if (itemCount % c == 0) return c;
        for (int c = max; c > 1; c--)            // 2) last row at least half full
        {
            int last = itemCount % c;
            if (last >= (c + 1) / 2) return c;
        }
        return 1;
    }
}
