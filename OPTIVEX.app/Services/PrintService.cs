using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;

namespace OPTIVEX.App.Services;

/// <summary>
/// Prints plain text through the standard Windows print dialog. Choosing "Microsoft Print to PDF" there saves a PDF,
/// which avoids shipping a PDF library. Nothing is sent anywhere unless the user picks a printer.
/// </summary>
public interface IPrintService
{
    /// <returns>False if the user cancelled the print dialog.</returns>
    bool PrintText(string title, string text);
}

public sealed class WpfPrintService : IPrintService
{
    public bool PrintText(string title, string text)
    {
        var dialog = new PrintDialog();
        if (dialog.ShowDialog() != true) return false;

        var doc = new FlowDocument
        {
            FontFamily = new FontFamily("Consolas"),
            FontSize = 10,
            Foreground = Brushes.Black,
            PagePadding = new Thickness(48),
            PageWidth = dialog.PrintableAreaWidth,
            PageHeight = dialog.PrintableAreaHeight,
            ColumnWidth = dialog.PrintableAreaWidth
        };
        foreach (var line in text.Replace("\r", "").Split('\n'))
            doc.Blocks.Add(new Paragraph(new Run(line.Length == 0 ? " " : line)) { Margin = new Thickness(0) });

        dialog.PrintDocument(((IDocumentPaginatorSource)doc).DocumentPaginator, title);
        return true;
    }
}
