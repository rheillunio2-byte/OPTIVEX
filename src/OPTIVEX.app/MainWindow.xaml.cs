using System.ComponentModel;
using System.Windows;
using System.Windows.Media.Animation;
using OPTIVEX.App.ViewModels;

namespace OPTIVEX.App;

public partial class MainWindow : Window
{
    private const double CompactBelowWidth = 1120;
    private readonly MainViewModel _viewModel;
    private bool _compact;

    public MainWindow(MainViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        DataContext = viewModel;

        Loaded += (_, _) => { ApplyLayout(); viewModel.Initialize(); };
        SizeChanged += (_, _) => ApplyLayout();
        viewModel.PropertyChanged += OnViewModelPropertyChanged;
    }

    /// <summary>Responsive shell: on narrow windows the sidebar collapses to icons so the page gets the room.</summary>
    private void ApplyLayout()
    {
        bool compact = ActualWidth < CompactBelowWidth;
        if (compact == _compact && SidebarColumn.Width.Value > 0 && IsLoaded) return;
        _compact = compact;
        SidebarColumn.Width = new GridLength(compact ? 76 : 240);
        BrandText.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
        SidebarNote.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
        FooterNote.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
        _viewModel.IsCompactSidebar = compact;
    }

    private void OnViewModelPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(MainViewModel.CurrentPage)) AnimatePageChange();
    }

    /// <summary>A short fade and slide when the page changes. Skipped when Windows has animations switched off.</summary>
    private void AnimatePageChange()
    {
        if (!SystemParameters.ClientAreaAnimation) return;
        var fade = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(180));
        var slide = new DoubleAnimation(10, 0, TimeSpan.FromMilliseconds(220)) { EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut } };
        ContentHost.BeginAnimation(OpacityProperty, fade);
        PageSlide.BeginAnimation(System.Windows.Media.TranslateTransform.YProperty, slide);
    }
}
