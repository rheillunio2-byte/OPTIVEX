using System.Text;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Models;

namespace OPTIVEX.Core.Gaming;

public static class GameValidator
{
    public static IReadOnlyList<string> Validate(GameRequirement g)
    {
        var e = new List<string>();
        if (string.IsNullOrWhiteSpace(g.Title) || g.Title.Trim().Length > 100) e.Add("Title is required (up to 100 characters).");
        foreach (var (label, value) in new (string, int?)[]
                 { ("Minimum RAM", g.Minimum.RamGb), ("Recommended RAM", g.Recommended.RamGb),
                   ("Minimum RAM (integrated graphics)", g.Minimum.RamGbIntegratedGpu), ("Recommended RAM (integrated graphics)", g.Recommended.RamGbIntegratedGpu) })
            if (value is int v && (v < 1 || v > 512)) e.Add($"{label} must be between 1 and 512 GB.");
        if (g.StorageGb is int s && (s < 1 || s > 5000)) e.Add("Storage must be between 1 and 5000 GB.");
        if (g.Minimum.RamGb is int mn && g.Recommended.RamGb is int rc && rc < mn) e.Add("Recommended RAM cannot be lower than the minimum.");
        foreach (var text in new[] { g.Minimum.Cpu, g.Minimum.Gpu, g.Minimum.Os, g.Recommended.Cpu, g.Recommended.Gpu, g.Recommended.Os, g.Source })
            if (text is { Length: > 300 }) { e.Add("Text fields are limited to 300 characters."); break; }
        if (g.Notes is { Length: > 600 }) e.Add("Notes are limited to 600 characters.");
        if (!g.Minimum.HasAnyData && g.StorageGb is null) e.Add("Enter at least one minimum requirement (CPU, GPU, RAM, OS or storage).");
        if (g.SourceKind != SourceKind.UserProvided && string.IsNullOrWhiteSpace(g.Source)) e.Add("A source is required for catalog entries.");
        return e;
    }

    public static IReadOnlyList<string> ValidateProfile(string? name, string? exePath, Func<string, bool> fileExists)
    {
        var e = new List<string>();
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 60) e.Add("Profile name is required (up to 60 characters).");
        if (!string.IsNullOrWhiteSpace(exePath))
        {
            var p = exePath.Trim();
            if (p.Length > 260 || !Path.IsPathRooted(p) || !p.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) e.Add("The program must be a full path ending in .exe.");
            else if (!fileExists(p)) e.Add("That program file was not found.");
        }
        return e;
    }
}

public sealed class GameCatalog
{
    private readonly IGameStore _store;
    private List<GameRequirement> _catalog = new();
    private List<GameRequirement> _user = new();
    private List<GameRequirement> _all = new();

    public GameCatalog(IGameStore store)
    {
        _store = store;
        Reload();
    }

    public event EventHandler? Changed;
    public IReadOnlyList<GameRequirement> All => _all;
    public bool CatalogLoaded => _catalog.Count > 0;

    public void Reload()
    {
        _catalog = _store.LoadCatalog().ToList();
        _user = _store.LoadUserGames().Select(g => g with { SourceKind = SourceKind.UserProvided }).ToList();
        Rebuild();
    }

    private void Rebuild()
    {
        _all = _catalog.Concat(_user).OrderBy(g => g.Title, StringComparer.OrdinalIgnoreCase).ToList();
        Changed?.Invoke(this, EventArgs.Empty);
    }

    public GameRequirement? Find(string id) => _all.FirstOrDefault(g => g.Id == id);

    public IReadOnlyList<GameRequirement> Search(string? query)
    {
        var tokens = Normalize(query).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (tokens.Length == 0) return _all;
        return _all.Where(g => { var t = Normalize(g.Title); return tokens.All(tok => t.Contains(tok, StringComparison.Ordinal)); }).ToList();
    }

    /// <summary>Always stored as user-provided; the id and source label are assigned here, never by the caller.</summary>
    public (bool Ok, IReadOnlyList<string> Errors) AddUserGame(GameRequirement draft)
    {
        var game = draft with
        {
            Id = "user-" + Guid.NewGuid().ToString("N")[..8],
            Title = draft.Title.Trim(),
            SourceKind = SourceKind.UserProvided,
            Source = string.IsNullOrWhiteSpace(draft.Source) ? "User-provided" : draft.Source.Trim(),
            LastVerified = null
        };
        var errors = GameValidator.Validate(game).ToList();
        if (_all.Any(g => Normalize(g.Title) == Normalize(game.Title))) errors.Add("A game with this title already exists.");
        if (errors.Count > 0) return (false, errors);

        _user.Add(game);
        _store.SaveUserGames(_user);
        Rebuild();
        return (true, Array.Empty<string>());
    }

    public bool RemoveUserGame(string id)
    {
        var g = _user.FirstOrDefault(x => x.Id == id);
        if (g is null) return false;
        _user.Remove(g);
        _store.SaveUserGames(_user);
        Rebuild();
        return true;
    }

    public static string Normalize(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        var sb = new StringBuilder();
        foreach (var ch in s.ToLowerInvariant())
        {
            if (ch is '\'' or '’') continue;
            sb.Append(char.IsLetterOrDigit(ch) ? ch : ' ');
        }
        return string.Join(' ', sb.ToString().Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }
}
