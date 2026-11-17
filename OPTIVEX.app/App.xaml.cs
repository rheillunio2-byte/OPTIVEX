using System.IO;
using System.Threading;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using OPTIVEX.App.Services;
using OPTIVEX.App.ViewModels;
using OPTIVEX.Core.Abstractions;
using OPTIVEX.Core.Gaming;
using OPTIVEX.Core.Intelligence;
using OPTIVEX.Core.Reporting;
using OPTIVEX.Data;
using OPTIVEX.Infrastructure.Hardware;
using OPTIVEX.Infrastructure.Laptop;
using OPTIVEX.Infrastructure.Monitoring;
using OPTIVEX.Infrastructure.Performance;
using OPTIVEX.Infrastructure.Storage;
using Serilog;

namespace OPTIVEX.App;

public partial class App : Application
{
    private ServiceProvider? _services;
    private Mutex? _instanceMutex;
    private bool _ownsMutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // One copy at a time: two instances would fight over the history database and the live sensors.
        _instanceMutex = new Mutex(true, @"Local\OPTIVEX.SingleInstance", out _ownsMutex);
        if (!_ownsMutex)
        {
            MessageBox.Show("OPTIVEX is already running. Look for it in the taskbar.", "OPTIVEX", MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown();
            return;
        }

        // Logs stay on this machine (see Settings → Data and privacy).
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Information()
            .WriteTo.File(Path.Combine(AppPaths.LogsDirectory, "optivex-.log"), rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14)
            .CreateLogger();
        Log.Information("OPTIVEX {Version} starting", AppInfo.Version);

        DispatcherUnhandledException += (_, args) =>
        {
            Log.Error(args.Exception, "Unhandled UI exception");
            MessageBox.Show($"An unexpected error occurred and was logged. OPTIVEX will keep running.\n\n{args.Exception.Message}",
                "OPTIVEX", MessageBoxButton.OK, MessageBoxImage.Error);
            args.Handled = true;
        };
        TaskScheduler.UnobservedTaskException += (_, args) => { Log.Error(args.Exception, "Unobserved task exception"); args.SetObserved(); };
        AppDomain.CurrentDomain.UnhandledException += (_, args) => Log.Fatal(args.ExceptionObject as Exception, "Fatal unhandled exception");

        var services = new ServiceCollection();
        ConfigureServices(services);
        _services = services.BuildServiceProvider();

        // Apply the history retention setting in the background; it must never delay start-up.
        var recorder = _services.GetRequiredService<HistoryRecorder>();
        _ = Task.Run(recorder.ApplyRetention);

        var window = _services.GetRequiredService<OPTIVEX.App.MainWindow>();
        MainWindow = window;
        window.Show();
    }

    private static void ConfigureServices(IServiceCollection s)
    {
        // ---- infrastructure
        s.AddSingleton<IHardwareScanner, HardwareScanner>();
        s.AddSingleton<IStorageScanner, SafeStorageScanner>();
        s.AddSingleton<ILiveMetricsProvider, LiveMetricsProvider>(); // IDisposable: disposed with the container
        s.AddSingleton<ILargeFileAnalyzer, LargeFileAnalyzer>();
        s.AddSingleton<IProcessMonitor, ProcessMonitor>();
        s.AddSingleton<IStartupManager, StartupManager>();
        s.AddSingleton<ISystemSettingsReader, SystemSettingsReader>();
        s.AddSingleton<IBatteryProvider, BatteryProvider>();
        s.AddSingleton<IBatteryReportService>(_ => new BatteryReportService(AppPaths.ReportsDirectory));

        // ---- app services
        s.AddSingleton<IDialogService, WpfDialogService>();
        s.AddSingleton<IShellService, ShellService>();
        s.AddSingleton<IPrintService, WpfPrintService>();
        s.AddSingleton<NavigationService>();

        // ---- core services
        s.AddSingleton<SystemAnalyzer>();
        s.AddSingleton<IGameStore>(_ => new JsonGameStore(Path.Combine(AppContext.BaseDirectory, "Data", "catalog.json"), AppPaths.DataDirectory));
        s.AddSingleton<GameCatalog>();

        // ---- settings and history (the history database failing to open must not stop the app)
        s.AddSingleton<ISettingsStore>(_ => new JsonSettingsStore(AppPaths.SettingsPath));
        s.AddSingleton<SettingsService>();
        s.AddSingleton<IHistoryStore>(_ =>
        {
            try { return new SqliteHistoryStore(AppPaths.HistoryDatabasePath); }
            catch (Exception ex)
            {
                Log.Error(ex, "History database could not be opened");
                return new UnavailableHistoryStore(ex.Message);
            }
        });
        s.AddSingleton<HistoryRecorder>(p => new HistoryRecorder(p.GetRequiredService<IHistoryStore>(),
            () => p.GetRequiredService<SettingsService>().Current, ex => Log.Warning(ex, "Recording history failed")));
        s.AddSingleton<IHistoryRecorder>(p => p.GetRequiredService<HistoryRecorder>());

        // ---- pages: registration order = sidebar order (matches the product spec)
        s.AddSingleton<PageViewModel>(p => new OverviewViewModel(p.GetRequiredService<IHardwareScanner>(), p.GetRequiredService<SystemAnalyzer>(),
            p.GetRequiredService<IHistoryRecorder>(), p.GetRequiredService<NavigationService>(), p.GetRequiredService<SettingsService>()));
        s.AddSingleton<PageViewModel>(p => new SystemHealthViewModel(p.GetRequiredService<ILiveMetricsProvider>(), p.GetRequiredService<IHardwareScanner>(),
            p.GetRequiredService<SettingsService>()));
        s.AddSingleton<PageViewModel>(p => new StorageCleanerViewModel(p.GetRequiredService<IStorageScanner>(), p.GetRequiredService<IDialogService>(),
            new LargeFilesViewModel(p.GetRequiredService<ILargeFileAnalyzer>(), p.GetRequiredService<IShellService>()), p.GetRequiredService<IHistoryRecorder>()));
        s.AddSingleton<PageViewModel>(p => new PerformanceViewModel(p.GetRequiredService<IProcessMonitor>(), p.GetRequiredService<IStartupManager>(),
            p.GetRequiredService<ISystemSettingsReader>(), p.GetRequiredService<IDialogService>(), p.GetRequiredService<IHistoryRecorder>(),
            p.GetRequiredService<SettingsService>()));
        s.AddSingleton<PageViewModel>(p => new GamingCenterViewModel(p.GetRequiredService<IHardwareScanner>(), p.GetRequiredService<ILiveMetricsProvider>(),
            p.GetRequiredService<IProcessMonitor>(), p.GetRequiredService<ISystemSettingsReader>(), p.GetRequiredService<GameCatalog>(),
            p.GetRequiredService<IGameStore>(), p.GetRequiredService<IDialogService>(), p.GetRequiredService<SettingsService>()));
        s.AddSingleton<PageViewModel>(p => new GameCompatibilityViewModel(p.GetRequiredService<GameCatalog>(), p.GetRequiredService<IHardwareScanner>()));
        s.AddSingleton<PageViewModel>(p => new LaptopCareViewModel(p.GetRequiredService<IBatteryProvider>(), p.GetRequiredService<ILiveMetricsProvider>(),
            p.GetRequiredService<ISystemSettingsReader>(), p.GetRequiredService<IBatteryReportService>(), p.GetRequiredService<IShellService>(),
            p.GetRequiredService<IDialogService>(), p.GetRequiredService<NavigationService>()));
        s.AddSingleton<PageViewModel>(p => new ReportsViewModel(p.GetRequiredService<IHistoryStore>(), p.GetRequiredService<SettingsService>(),
            p.GetRequiredService<IDialogService>(), p.GetRequiredService<IPrintService>()));
        s.AddSingleton<PageViewModel>(p => new SettingsViewModel(p.GetRequiredService<SettingsService>(), p.GetRequiredService<IHistoryStore>(),
            p.GetRequiredService<IDialogService>(), p.GetRequiredService<IShellService>()));

        s.AddSingleton<MainViewModel>();
        s.AddTransient<OPTIVEX.App.MainWindow>();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        Log.Information("OPTIVEX exiting");
        Log.CloseAndFlush();
        _services?.Dispose();
        if (_ownsMutex) { try { _instanceMutex?.ReleaseMutex(); } catch (ApplicationException) { } }
        _instanceMutex?.Dispose();
        base.OnExit(e);
    }
}
