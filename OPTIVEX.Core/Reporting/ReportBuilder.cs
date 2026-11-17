using System.Globalization;
using System.Text;
using OPTIVEX.Core.Formatting;
using OPTIVEX.Core.Models;

namespace OPTIVEX.Core.Reporting;

public sealed record MetricChange(string Label, string Before, string After, string Change);
public enum HistoryDataset { SystemScans, StorageScans, Cleanups, Actions, Analyses }
public sealed record ReportTable(string Title, IReadOnlyList<string> Headers, IReadOnlyList<IReadOnlyList<string>> Rows);

/// <summary>Compares two system scans. Reports differences only; it makes no judgement about whether they are good or bad.</summary>
public static class HistoryComparer
{
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
    private static string Gb(double v) => v.ToString("0.0", Inv) + " GB";
    private static string Delta(double d) => d.ToString("+0.0;-0.0;0.0", Inv) + " GB";

    public static IReadOnlyList<MetricChange> Compare(SystemScanRecord older, SystemScanRecord newer)
    {
        var list = new List<MetricChange>();

        list.Add(Math.Abs(older.TotalRamGb - newer.TotalRamGb) < 0.05
            ? new("Installed memory", Gb(older.TotalRamGb), Gb(newer.TotalRamGb), "No change")
            : new("Installed memory", Gb(older.TotalRamGb), Gb(newer.TotalRamGb), Delta(newer.TotalRamGb - older.TotalRamGb)));

        list.Add(older.UsedRamGb is double a && newer.UsedRamGb is double b
            ? new("Memory in use at scan time", Gb(a), Gb(b), Delta(b - a) + " (depends on what was running)")
            : new("Memory in use at scan time", older.UsedRamGb is double x ? Gb(x) : "Not recorded", newer.UsedRamGb is double y ? Gb(y) : "Not recorded", "Cannot compare"));

        foreach (var d in older.Drives)
        {
            var match = newer.Drives.FirstOrDefault(n => string.Equals(n.Name, d.Name, StringComparison.OrdinalIgnoreCase));
            if (match is null) { list.Add(new($"Drive {d.Name}", "Present", "Not present", "Removed or unavailable")); continue; }
            string change = Math.Abs(d.FreeGb - match.FreeGb) < 0.05 ? "No change" : Delta(match.FreeGb - d.FreeGb);
            if (Math.Abs(d.TotalGb - match.TotalGb) >= 0.5) change += $" (capacity changed {Gb(d.TotalGb)} to {Gb(match.TotalGb)})";
            list.Add(new($"Free space on {d.Name}", Gb(d.FreeGb), Gb(match.FreeGb), change));
        }
        foreach (var n in newer.Drives.Where(n => !older.Drives.Any(d => string.Equals(d.Name, n.Name, StringComparison.OrdinalIgnoreCase))))
            list.Add(new($"Drive {n.Name}", "Not present", "Present", "New drive"));

        if (older.Windows != newer.Windows) list.Add(new("Windows version", older.Windows, newer.Windows, "Changed"));
        if (older.Cpu != newer.Cpu) list.Add(new("Processor", older.Cpu, newer.Cpu, "Changed"));
        if (older.Gpu != newer.Gpu) list.Add(new("Graphics", older.Gpu, newer.Gpu, "Changed"));
        return list;
    }
}

public static class ReportTables
{
    private static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
    public static string Date(DateTime d) => d.ToString("yyyy-MM-dd HH:mm", Inv);
    private static string N(double v) => v.ToString("0.0", Inv);
    private static IReadOnlyList<string> Row(params string[] cells) => cells;

    public static ReportTable For(HistoryDataset dataset, HistoryData d) => dataset switch
    {
        HistoryDataset.SystemScans => new("System scans",
            new[] { "Date", "Computer", "Windows", "CPU", "GPU", "Logical processors", "RAM total (GB)", "RAM used (GB)", "Drives (free/total GB)" },
            d.SystemScans.Select(s => Row(Date(s.TakenAt), s.ComputerName, s.Windows, s.Cpu, s.Gpu, s.LogicalProcessors.ToString(Inv), N(s.TotalRamGb),
                s.UsedRamGb is double u ? N(u) : "not recorded",
                string.Join("; ", s.Drives.Select(x => $"{x.Name} {N(x.FreeGb)}/{N(x.TotalGb)}")))).ToList()),
        HistoryDataset.StorageScans => new("Storage scans",
            new[] { "Date", "Files found", "Total bytes", "Total size", "List was capped", "Categories" },
            d.StorageScans.Select(s => Row(Date(s.TakenAt), s.Files.ToString(Inv), s.TotalBytes.ToString(Inv), ByteFormat.Format(s.TotalBytes), s.Truncated ? "yes" : "no",
                string.Join("; ", s.Categories.Select(c => $"{c.Category}: {c.Files} files, {ByteFormat.Format(c.Bytes)}")))).ToList()),
        HistoryDataset.Cleanups => new("Cleanup history",
            new[] { "Date", "Files selected", "Files deleted", "Bytes recovered", "Space recovered", "Files skipped" },
            d.Cleanups.Select(c => Row(Date(c.TakenAt), c.Selected.ToString(Inv), c.Deleted.ToString(Inv), c.Bytes.ToString(Inv), ByteFormat.Format(c.Bytes), c.Skipped.ToString(Inv))).ToList()),
        HistoryDataset.Actions => new("Optimization actions",
            new[] { "Date", "Action", "Target", "Details" },
            d.Actions.Select(a => Row(Date(a.TakenAt), a.Action, a.Target, a.Details)).ToList()),
        _ => new("Analyses",
            new[] { "Date", "Recommendations", "Issues", "Not assessed" },
            d.Analyses.Select(a => Row(Date(a.TakenAt), a.Recommendations.ToString(Inv), string.Join("; ", a.Issues), string.Join("; ", a.NotAssessed))).ToList())
    };
}

public static class CsvExporter
{
    /// <summary>RFC 4180 quoting, plus protection against spreadsheet formula injection: a text cell that starts
    /// with = + - @ (and is not a plain number) is prefixed with an apostrophe so Excel treats it as text.</summary>
    public static string Write(IReadOnlyList<string> headers, IEnumerable<IReadOnlyList<string>> rows)
    {
        var sb = new StringBuilder();
        sb.Append(Line(headers));
        foreach (var r in rows) sb.Append(Line(r));
        return sb.ToString();
    }

    private static string Line(IEnumerable<string> cells) => string.Join(",", cells.Select(Cell)) + "\r\n";

    public static string Cell(string? value)
    {
        var s = value ?? "";
        if (s.Length > 0 && "=+-@\t\r".IndexOf(s[0]) >= 0 &&
            !double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out _)) s = "'" + s;
        return s.IndexOfAny(new[] { ',', '"', '\r', '\n' }) >= 0 ? "\"" + s.Replace("\"", "\"\"") + "\"" : s;
    }
}

public static class ReportBuilder
{
    /// <summary>Plain-text report of the whole local history, for saving as .txt or printing to PDF.</summary>
    public static string BuildText(HistoryData data, DateTime generatedAt, string version)
    {
        var sb = new StringBuilder();
        sb.AppendLine("OPTIVEX REPORT");
        sb.AppendLine($"Generated {ReportTables.Date(generatedAt)} by OPTIVEX {version}");
        sb.AppendLine("All data in this report was collected and stored on this PC only.");
        sb.AppendLine();

        sb.AppendLine("LATEST SYSTEM SCAN");
        if (data.SystemScans.Count == 0) sb.AppendLine("  None recorded yet.");
        else
        {
            var s = data.SystemScans[0];
            var inv = CultureInfo.InvariantCulture;
            sb.AppendLine($"  Taken        : {ReportTables.Date(s.TakenAt)}");
            sb.AppendLine($"  Computer     : {s.ComputerName}");
            sb.AppendLine($"  Windows      : {s.Windows}");
            sb.AppendLine($"  Processor    : {s.Cpu} ({s.LogicalProcessors} logical processors)");
            sb.AppendLine($"  Graphics     : {s.Gpu}");
            sb.AppendLine($"  Memory       : {s.TotalRamGb.ToString("0.0", inv)} GB total" + (s.UsedRamGb is double u ? $", {u.ToString("0.0", inv)} GB in use" : ", usage not recorded"));
            foreach (var d in s.Drives)
                sb.AppendLine($"  Drive {d.Name,-4}  : {d.FreeGb.ToString("0.0", inv)} GB free of {d.TotalGb.ToString("0.0", inv)} GB");
            if (data.SystemScans.Count > 1)
            {
                sb.AppendLine();
                sb.AppendLine($"  Changes since the previous scan ({ReportTables.Date(data.SystemScans[1].TakenAt)}):");
                foreach (var c in HistoryComparer.Compare(data.SystemScans[1], s))
                    sb.AppendLine($"    {c.Label}: {c.Before} -> {c.After} ({c.Change})");
            }
        }

        foreach (var ds in new[] { HistoryDataset.SystemScans, HistoryDataset.StorageScans, HistoryDataset.Cleanups, HistoryDataset.Actions, HistoryDataset.Analyses })
        {
            var t = ReportTables.For(ds, data);
            sb.AppendLine();
            sb.AppendLine($"{t.Title.ToUpperInvariant()} ({t.Rows.Count})");
            if (t.Rows.Count == 0) { sb.AppendLine("  None recorded."); continue; }
            foreach (var r in t.Rows)
            {
                sb.AppendLine("  " + r[0]);
                for (int i = 1; i < r.Count; i++)
                    if (!string.IsNullOrWhiteSpace(r[i])) sb.AppendLine($"    {t.Headers[i]}: {r[i]}");
            }
        }

        if (data.Cleanups.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine($"TOTAL RECOVERED BY CLEANUPS: {ByteFormat.Format(data.Cleanups.Sum(c => c.Bytes))} across {data.Cleanups.Count} cleanup(s).");
        }
        return sb.ToString();
    }
}
