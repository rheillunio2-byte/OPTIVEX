# Design system

All visual decisions live in `src/OPTIVEX.App/Views/Theme.xaml`. Pages should use these styles and brushes, not hard-coded colours or sizes, so the whole app can be re-themed in one place.

> Status: written without being rendered. Appearance, spacing and contrast on a real screen are unverified; treat the values below as the intended design.

## Principles

1. **Calm and readable.** A dark, low-glare surface with one accent colour. Colour carries meaning (green/amber/red for health, cyan for emphasis), never decoration alone.
2. **Honest states.** Loading, empty, unavailable and error states are designed, not an afterthought. "Unavailable" is shown in the muted colour with its reason.
3. **Safe by default.** Destructive buttons use the danger colour, say what they do, and always lead to a confirmation whose default button is "No".
4. **Keyboard first-class.** Everything reachable by keyboard has a visible focus ring.
5. **Responsive.** Card rows reflow with the window; the sidebar collapses to icons below 1120 px.

## Colour

| Token | Value | Use |
|---|---|---|
| `BgBrush` | `#101526` | Window background |
| `SidebarBrush` | `#0C1220` | Sidebar, footer, tooltips |
| `PanelBrush` | `#192337` | Cards |
| `Panel2Brush` | `#202D43` | Inner cards, inputs, secondary buttons, table headers |
| `LineBrush` | `#26344D` | 1 px borders |
| `TextBrush` / `TextSoftBrush` / `MutedBrush` | `#F2F5FA` / `#C5CFDC` / `#9AA8BB` | Primary, body, secondary text |
| `CyanBrush` | `#58D6F5` | Accent: focus rings, active icon, key figures |
| `PrimaryGradient` | `#2D6FE8` → `#2257D0` | Primary buttons |
| `DangerBrush` | `#C0392B` | Destructive buttons |
| `WarnBrush` | `#F5B942` | Warnings and notes |
| `SelectionBrush` / `HoverBrush` | `#25406B` / `#1F2D45` | Selected and hovered rows and items |

Health colours (green `#3DDC97`, amber `#F5B942`, red `#FF5C5C`, grey) come from `HealthLevelToBrushConverter` and are **display heuristics**, not vendor limits.

**Contrast:** muted text on a card is about 6.4:1; white on the primary button is 4.6:1 or better (WCAG AA for normal text is 4.5:1). These are calculated values, not measurements from a rendered screen.

## Typography

Segoe UI Variable Text, falling back to Segoe UI.

| Style | Size / weight | Use |
|---|---|---|
| `PageTitle` | 28 bold | Page heading |
| `SectionTitle` | 16 semibold | Card headings, tile titles |
| `MetricValue` | 22 semibold | Big numbers |
| `MetricLabel` | 10 bold, muted | Small caps-style labels above values |
| `Caption` | 11, muted | Notes, status lines, reasons |

## Components

| Style | Use |
|---|---|
| `Card`, `CardInner`, `Chip` | Surfaces (radius 14 / 12 / 10, 1 px line border) |
| Default `Button` | Primary action (gradient). Hover brightens, press darkens, focus shows a cyan ring |
| `SecondaryButton`, `DangerButton`, `TileButton` | Secondary, destructive and card-style buttons |
| Mode buttons | Highlighted with `ModeToBrushConverter` to show the active tab/option |
| `AdaptivePanel` (`ctl:`) | Responsive card rows: `MinItemWidth` is the narrowest a card may get |
| `DialogWindow` | Dark dialogs with scrolling text; Yes/No default is No, Esc cancels |
| Page icons | 24×24 line icons in Theme.xaml (`Icon.*`), mapped from page titles by `PageIconConverter`; no icon font required |

Implicit styles also restyle `TextBox`, `CheckBox`, `ScrollBar`, `ToolTip`, `DataGrid` (rows, cells, headers) and the shared list item, so new pages are dark and consistent without extra work.

## Layout rules

- Page padding 28 px; cards 16 to 22 px inner padding; 10 px gaps (cards carry their own right/bottom margin).
- Rows of cards use `ctl:AdaptivePanel`. Typical `MinItemWidth`: 170 for five tiles, 200 for four, 240 for three, 380 for two.
- Long lists use `DataGrid` (virtualised). Forms use labelled text boxes with a muted caption above.

## Motion

A 180 to 220 ms fade and slide on page change. It is skipped when Windows has "Show animations" switched off. There are no other animations besides the standard busy indicator.

## Accessibility

- Visible keyboard focus on buttons, inputs, check boxes, list items and navigation.
- Ctrl+1 to Ctrl+9 for navigation; Enter/Esc in dialogs.
- `AutomationProperties.Name` on navigation items, tiles, the logo, the privilege chip and dialogs.
- Status is never colour-only: statuses also have text ("HIGH PRIORITY", "Unavailable", ✔/✖).
- Not yet done: a screen-reader pass, high-contrast-mode theme, scaling beyond 100 to 125 percent verification, and automation names on every control.

## Adding or changing UI

1. Add any new colour or style to `Theme.xaml` first.
2. Reuse `Card`, `Caption`, the button styles and `AdaptivePanel`.
3. Run the static checks described in `docs/TESTING.md` (style/element-type audit, resource keys, bindings), then actually look at the page on a real screen at two window widths and at 125 % scaling.
