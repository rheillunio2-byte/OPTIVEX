using System.Management;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Health;
using OPTIVEX.Core.Models;
using Serilog;

namespace OPTIVEX.Infrastructure.Laptop;

/// <summary>
/// Reads battery data from Windows through WMI (root\WMI for capacities, cycle count and charge state;
/// Win32_Battery for presence, name, chemistry and runtime). Nothing is estimated here: a value Windows does
/// not provide comes back as an unavailable reading with a reason. Read-only, no administrator rights needed.
/// </summary>
public sealed class BatteryProvider : IBatteryProvider
{
    private const double UnknownRuntime = 71582788; // Windows' "unknown / on AC" sentinel for EstimatedRunTime
    private const string Wmi = @"root\WMI";
    private const string Cimv2 = @"root\CIMV2";

    public Task<BatteryInfo> ReadAsync(CancellationToken token = default) => Task.Run(() =>
    {
        token.ThrowIfCancellationRequested();
        List<Dictionary<string, object?>> win32;
        try { win32 = Rows(Cimv2, "Win32_Battery", "Name", "EstimatedChargeRemaining", "EstimatedRunTime", "Chemistry", "BatteryStatus"); }
        catch (Exception ex)
        {
            Log.Warning(ex, "Win32_Battery query failed");
            return BatteryInfo.None("Windows could not be queried for battery information (" + ex.GetType().Name + ").");
        }
        if (win32.Count == 0)
            return BatteryInfo.None("Windows reports no battery. This looks like a desktop PC, or the battery is not exposed to Windows.");

        var primary = win32[0];
        var name = primary["Name"]?.ToString();
        var chemistry = ChemistryName(Num(primary["Chemistry"]));

        // ---- capacities (mWh -> Wh); summed when there is more than one battery
        var design = SumCapacity("BatteryStaticData", "DesignedCapacity", "Design capacity is not reported by this battery or its driver.");
        var full = SumCapacity("BatteryFullChargedCapacity", "FullChargedCapacity", "Full-charge capacity is not reported by this battery or its driver.");

        // ---- charge level and state
        double? remaining = null; bool? charging = null, discharging = null, online = null;
        try
        {
            var st = Rows(Wmi, "BatteryStatus", "RemainingCapacity", "Charging", "Discharging", "PowerOnline");
            if (st.Count > 0)
            {
                remaining = st.Select(r => Num(r["RemainingCapacity"])).Where(v => v is > 0 and < 100_000_000).Sum();
                charging = st.Any(r => r["Charging"] is true);
                discharging = st.Any(r => r["Discharging"] is true);
                online = st.Any(r => r["PowerOnline"] is true);
            }
        }
        catch (Exception ex) { Log.Debug(ex, "root\\WMI BatteryStatus unavailable"); }

        SensorReading charge;
        if (remaining is > 0 && full.Value is > 0) charge = SensorReading.Ok(Math.Clamp(remaining.Value / 1000d / full.Value.Value * 100, 0, 100));
        else if (Num(primary["EstimatedChargeRemaining"]) is double pct) charge = SensorReading.Ok(Math.Clamp(pct, 0, 100));
        else charge = SensorReading.Unavailable("Windows does not report the charge level.");

        var state = charging == true ? BatteryState.Charging
            : discharging == true ? BatteryState.Discharging
            : online == true ? BatteryState.PluggedInNotCharging
            : BatteryStateMapper.FromWin32((int?)Num(primary["BatteryStatus"]));

        // ---- runtime
        SensorReading runtime;
        var rt = Num(primary["EstimatedRunTime"]);
        if (state != BatteryState.Discharging) runtime = SensorReading.Unavailable("Runtime is only estimated while running on battery.");
        else if (rt is null || rt >= UnknownRuntime) runtime = SensorReading.Unavailable("Windows cannot estimate the remaining runtime yet.");
        else runtime = SensorReading.Ok(rt.Value);

        // ---- cycle count (many batteries and drivers do not provide it)
        SensorReading cycles;
        try
        {
            var c = Rows(Wmi, "BatteryCycleCount", "CycleCount");
            var total = c.Select(r => Num(r["CycleCount"])).Where(v => v is > 0 and < 100_000).ToList();
            cycles = total.Count > 0 ? SensorReading.Ok(total.Max()!.Value)
                : SensorReading.Unavailable("This battery reports no cycle count to Windows. The Windows battery report may show it.");
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "BatteryCycleCount unavailable");
            cycles = SensorReading.Unavailable("This battery or driver does not provide a cycle count to Windows. The Windows battery report may show it.");
        }

        Log.Information("Battery read: present, design={Design}, full={Full}, state={State}", design.Value, full.Value, state);
        return new BatteryInfo(true, null, name, chemistry, design, full, charge, state, cycles, runtime);
    }, token);

    private static SensorReading SumCapacity(string cls, string prop, string missingReason)
    {
        try
        {
            var values = Rows(Wmi, cls, prop).Select(r => Num(r[prop])).Where(v => v is > 0 and < 100_000_000).ToList();
            return values.Count > 0 ? SensorReading.Ok(values.Sum(v => v!.Value) / 1000d) : SensorReading.Unavailable(missingReason);
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "{Class} unavailable", cls);
            return SensorReading.Unavailable(missingReason);
        }
    }

    private static List<Dictionary<string, object?>> Rows(string scope, string cls, params string[] props)
    {
        var list = new List<Dictionary<string, object?>>();
        using var searcher = new ManagementObjectSearcher(scope, $"SELECT {string.Join(",", props)} FROM {cls}");
        foreach (ManagementBaseObject o in searcher.Get())
        {
            using (o)
            {
                var row = new Dictionary<string, object?>();
                foreach (var p in props) row[p] = o[p];
                list.Add(row);
            }
        }
        return list;
    }

    private static double? Num(object? v) => v switch
    {
        uint u => u, int i => i, ushort us => us, short s => s, ulong ul => ul, long l => l, byte b => b, _ => null
    };

    private static string? ChemistryName(double? code) => code switch
    {
        3 => "Lead acid", 4 => "Nickel-cadmium", 5 => "Nickel-metal hydride", 6 => "Lithium-ion", 7 => "Zinc-air", 8 => "Lithium polymer", _ => null
    };
}
