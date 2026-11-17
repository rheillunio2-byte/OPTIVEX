using System.Windows;
using System.Windows.Input;
using System.Windows.Media;

namespace OPTIVEX.App;

public enum DialogKind { Info, Warning, Error }

/// <summary>
/// The app's dark message dialog. Message text scrolls, so long previews (for example the cleanup preview) stay readable.
/// For confirmations the safe choice (No) is the default button and Esc cancels.
/// </summary>
public partial class DialogWindow : Window
{
    public DialogWindow(string title, string message, DialogKind kind, string primaryText, string? secondaryText, bool defaultIsSecondary)
    {
        InitializeComponent();
        TitleText.Text = title;
        MessageText.Text = message;

        switch (kind)
        {
            case DialogKind.Warning: KindGlyph.Text = "⚠"; KindGlyph.Foreground = (Brush)FindResource("WarnBrush"); break;
            case DialogKind.Error: KindGlyph.Text = "✖"; KindGlyph.Foreground = new SolidColorBrush(Color.FromRgb(0xFF, 0x5C, 0x5C)); break;
            default: KindGlyph.Text = "ℹ"; KindGlyph.Foreground = (Brush)FindResource("CyanBrush"); break;
        }

        PrimaryButton.Content = primaryText;
        bool hasSecondary = secondaryText is not null;
        SecondaryButton.Visibility = hasSecondary ? Visibility.Visible : Visibility.Collapsed;
        if (hasSecondary) SecondaryButton.Content = secondaryText;

        bool secondaryIsDefault = hasSecondary && defaultIsSecondary;
        PrimaryButton.IsDefault = !secondaryIsDefault;
        SecondaryButton.IsDefault = secondaryIsDefault;
        if (hasSecondary) SecondaryButton.IsCancel = true; else PrimaryButton.IsCancel = true; // Esc always closes without confirming
        Loaded += (_, _) => (secondaryIsDefault ? SecondaryButton : PrimaryButton).Focus();
    }

    private void Primary_Click(object sender, RoutedEventArgs e) => DialogResult = true;
    private void Secondary_Click(object sender, RoutedEventArgs e) => DialogResult = false;

    private void Header_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton == MouseButton.Left) DragMove();
    }
}
