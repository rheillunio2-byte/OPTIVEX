using System.Reflection;
using System.Security.Principal;

namespace OPTIVEX.App.Services;

public static class AppInfo
{
    public static string Version { get; } = Read();

    /// <summary>Whether OPTIVEX is running elevated. It never elevates itself; this only explains why some sensors may be unavailable.</summary>
    public static bool IsAdministrator { get; } = ReadElevation();

    private static bool ReadElevation()
    {
        try
        {
            using var id = WindowsIdentity.GetCurrent();
            return new WindowsPrincipal(id).IsInRole(WindowsBuiltInRole.Administrator);
        }
        catch { return false; }
    }

    private static string Read()
    {
        var v = Assembly.GetEntryAssembly()?.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "dev";
        var plus = v.IndexOf('+');
        return plus > 0 ? v[..plus] : v;
    }
}
