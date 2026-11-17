using System.Globalization;
using System.Text.Json;
using Microsoft.Data.Sqlite;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Models;

namespace OPTIVEX.Data;

/// <summary>
/// SQLite history database (local file, no network). Every statement is parameterised, so text coming from
/// the system (computer name, startup entry names…) can never alter the SQL. Timestamps are stored as UTC ISO-8601.
/// Schema versioning uses PRAGMA user_version.
/// </summary>
public sealed class SqliteHistoryStore : IHistoryStore
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static readonly string[] Tables = { "system_scans", "storage_scans", "cleanups", "actions", "analyses" };
    private readonly string _connectionString;

    public SqliteHistoryStore(string databasePath)
    {
        var dir = Path.GetDirectoryName(Path.GetFullPath(databasePath));
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        _connectionString = new SqliteConnectionStringBuilder { DataSource = databasePath, Mode = SqliteOpenMode.ReadWriteCreate, Pooling = false }.ToString();
        Migrate();
    }

    private SqliteConnection Open()
    {
        var c = new SqliteConnection(_connectionString);
        c.Open();
        return c;
    }

    private void Migrate()
    {
        using var c = Open();
        using var ver = c.CreateCommand();
        ver.CommandText = "PRAGMA user_version;";
        var version = Convert.ToInt32(ver.ExecuteScalar(), CultureInfo.InvariantCulture);
        if (version >= 1) return;

        using var cmd = c.CreateCommand();
        cmd.CommandText = @"
CREATE TABLE system_scans (id INTEGER PRIMARY KEY AUTOINCREMENT, taken_at TEXT NOT NULL, computer TEXT, windows TEXT, cpu TEXT, gpu TEXT,
    logical_processors INTEGER, total_ram_gb REAL, used_ram_gb REAL, drives_json TEXT NOT NULL);
CREATE TABLE storage_scans (id INTEGER PRIMARY KEY AUTOINCREMENT, taken_at TEXT NOT NULL, files INTEGER, total_bytes INTEGER, truncated INTEGER, categories_json TEXT NOT NULL);
CREATE TABLE cleanups (id INTEGER PRIMARY KEY AUTOINCREMENT, taken_at TEXT NOT NULL, selected INTEGER, deleted INTEGER, bytes INTEGER, skipped INTEGER);
CREATE TABLE actions (id INTEGER PRIMARY KEY AUTOINCREMENT, taken_at TEXT NOT NULL, action TEXT, target TEXT, details TEXT);
CREATE TABLE analyses (id INTEGER PRIMARY KEY AUTOINCREMENT, taken_at TEXT NOT NULL, recommendations INTEGER, issues_json TEXT NOT NULL, not_assessed_json TEXT NOT NULL);
PRAGMA user_version = 1;";
        cmd.ExecuteNonQuery();
    }

    private static string Ts(DateTime d) => d.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);
    private static DateTime ParseTs(string s) => DateTime.Parse(s, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind).ToLocalTime();

    private long Insert(string sql, params (string Name, object? Value)[] parameters)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = sql + "; SELECT last_insert_rowid();";
        foreach (var (name, value) in parameters) cmd.Parameters.AddWithValue(name, value ?? DBNull.Value);
        return Convert.ToInt64(cmd.ExecuteScalar(), CultureInfo.InvariantCulture);
    }

    public long AddSystemScan(SystemScanRecord r) => Insert(
        "INSERT INTO system_scans (taken_at, computer, windows, cpu, gpu, logical_processors, total_ram_gb, used_ram_gb, drives_json) VALUES (@t,@pc,@win,@cpu,@gpu,@lp,@tr,@ur,@dr)",
        ("@t", Ts(r.TakenAt)), ("@pc", r.ComputerName), ("@win", r.Windows), ("@cpu", r.Cpu), ("@gpu", r.Gpu), ("@lp", r.LogicalProcessors),
        ("@tr", r.TotalRamGb), ("@ur", r.UsedRamGb), ("@dr", JsonSerializer.Serialize(r.Drives, Json)));

    public long AddStorageScan(StorageScanRecord r) => Insert(
        "INSERT INTO storage_scans (taken_at, files, total_bytes, truncated, categories_json) VALUES (@t,@f,@b,@tr,@c)",
        ("@t", Ts(r.TakenAt)), ("@f", r.Files), ("@b", r.TotalBytes), ("@tr", r.Truncated ? 1 : 0), ("@c", JsonSerializer.Serialize(r.Categories, Json)));

    public long AddCleanup(CleanupRecord r) => Insert(
        "INSERT INTO cleanups (taken_at, selected, deleted, bytes, skipped) VALUES (@t,@s,@d,@b,@k)",
        ("@t", Ts(r.TakenAt)), ("@s", r.Selected), ("@d", r.Deleted), ("@b", r.Bytes), ("@k", r.Skipped));

    public long AddAction(OptimizationActionRecord r) => Insert(
        "INSERT INTO actions (taken_at, action, target, details) VALUES (@t,@a,@g,@d)",
        ("@t", Ts(r.TakenAt)), ("@a", r.Action), ("@g", r.Target), ("@d", r.Details));

    public long AddAnalysis(AnalysisRecord r) => Insert(
        "INSERT INTO analyses (taken_at, recommendations, issues_json, not_assessed_json) VALUES (@t,@n,@i,@x)",
        ("@t", Ts(r.TakenAt)), ("@n", r.Recommendations), ("@i", JsonSerializer.Serialize(r.Issues, Json)), ("@x", JsonSerializer.Serialize(r.NotAssessed, Json)));

    private List<T> Query<T>(string table, string columns, int limit, Func<SqliteDataReader, T> map)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        // table and columns are constants from this class, never user input
        cmd.CommandText = $"SELECT {columns} FROM {table} ORDER BY taken_at DESC, id DESC LIMIT @n";
        cmd.Parameters.AddWithValue("@n", Math.Clamp(limit, 1, 5000));
        var list = new List<T>();
        using var r = cmd.ExecuteReader();
        while (r.Read()) list.Add(map(r));
        return list;
    }

    private static string Str(SqliteDataReader r, int i) => r.IsDBNull(i) ? "" : r.GetString(i);

    public HistoryData LoadAll(int limitPerTable = 500) => new(
        Query("system_scans", "id, taken_at, computer, windows, cpu, gpu, logical_processors, total_ram_gb, used_ram_gb, drives_json", limitPerTable,
            r => new SystemScanRecord(r.GetInt64(0), ParseTs(r.GetString(1)), Str(r, 2), Str(r, 3), Str(r, 4), Str(r, 5), (int)r.GetInt64(6), r.GetDouble(7),
                r.IsDBNull(8) ? null : r.GetDouble(8), JsonSerializer.Deserialize<List<DriveSnapshot>>(r.GetString(9), Json) ?? new())),
        Query("storage_scans", "id, taken_at, files, total_bytes, truncated, categories_json", limitPerTable,
            r => new StorageScanRecord(r.GetInt64(0), ParseTs(r.GetString(1)), (int)r.GetInt64(2), r.GetInt64(3), r.GetInt64(4) != 0,
                JsonSerializer.Deserialize<List<CategoryTotal>>(r.GetString(5), Json) ?? new())),
        Query("cleanups", "id, taken_at, selected, deleted, bytes, skipped", limitPerTable,
            r => new CleanupRecord(r.GetInt64(0), ParseTs(r.GetString(1)), (int)r.GetInt64(2), (int)r.GetInt64(3), r.GetInt64(4), (int)r.GetInt64(5))),
        Query("actions", "id, taken_at, action, target, details", limitPerTable,
            r => new OptimizationActionRecord(r.GetInt64(0), ParseTs(r.GetString(1)), Str(r, 2), Str(r, 3), Str(r, 4))),
        Query("analyses", "id, taken_at, recommendations, issues_json, not_assessed_json", limitPerTable,
            r => new AnalysisRecord(r.GetInt64(0), ParseTs(r.GetString(1)), (int)r.GetInt64(2),
                JsonSerializer.Deserialize<List<string>>(r.GetString(3), Json) ?? new(), JsonSerializer.Deserialize<List<string>>(r.GetString(4), Json) ?? new())));

    public int PurgeOlderThan(DateTime cutoffUtc)
    {
        using var c = Open();
        int removed = 0;
        foreach (var table in Tables)
        {
            using var cmd = c.CreateCommand();
            cmd.CommandText = $"DELETE FROM {table} WHERE taken_at < @c";
            cmd.Parameters.AddWithValue("@c", Ts(cutoffUtc));
            removed += cmd.ExecuteNonQuery();
        }
        return removed;
    }

    public void ClearAll()
    {
        using var c = Open();
        foreach (var table in Tables)
        {
            using var cmd = c.CreateCommand();
            cmd.CommandText = $"DELETE FROM {table}";
            cmd.ExecuteNonQuery();
        }
    }
}
