/**
 * `@/ui3d` — the in-scene widget kit (STYLE_GUIDE §6). All UI is WebGL: SDF text + SDF shapes, batched.
 * Chapter authors: read `docs/UI_API.md`.
 */
export { UiNode, layoutTree, type NodeProps, type UiHandlers, type Size, type FloatSpec } from './core/node';
export { UiSurface, MeshNode, type UiHost, type SurfaceOptions } from './core/surface';
export { Painter, rgba, mixRgba, withAlpha, lit, type Rgba, type ShapeStyle } from './core/painter';
export { ICON_NAMES, type IconName } from './core/icons';
export { uiFocus, sfx, onUiSound, type UiSound } from './core/focus';
export {
  UI,
  TEXT_COLOR,
  PLANT_TYPE,
  STATUS,
  UI_STATUS,
  FLOW,
  setAccent,
  accentOf,
  type PlantType,
} from './theme';
export { uiHost, hudSurface, worldSurface, type WorldSurfaceOptions } from './host';
export { worldConsole, type WorldConsole, type WorldConsoleOptions } from './console';
export { Label, type LabelStyle } from './widgets/label';
export { Control } from './widgets/control';
export { Panel, Icon, Divider, row, col, spacer, type PanelProps } from './widgets/panel';
export { Button, iconButton, type ButtonProps } from './widgets/button';
export { Slider, type SliderProps } from './widgets/slider';
export { niceTicks, tToValue, valueToT, type SliderScale } from './widgets/slider-scale';
export { Toggle, type ToggleProps } from './widgets/toggle';
export { Tabs, type TabItem, type TabsProps } from './widgets/tabs';
export { Chip, honesty, type ChipKind, type ChipProps } from './widgets/chip';
export { Stepper, type StepperProps } from './widgets/stepper';
export { Readout, FormulaBlock, type ReadoutProps, type FormulaProps } from './widgets/readout';
export { Gauge, type GaugeProps, type GaugeZone } from './widgets/gauge';
export { ProgressRing, type ProgressRingProps } from './widgets/progress';
export { Legend, type LegendItem, type LegendProps } from './widgets/legend';
export { Toast, ToastStack, type ToastOptions } from './widgets/toast';
export { Tooltip } from './widgets/tooltip';
export { ScrollView, type ScrollProps } from './widgets/scroll';
export { Pager, type PagerProps } from './widgets/pager';
export { Card, type CardProps } from './widgets/card';
export {
  Table,
  StatGrid,
  type TableProps,
  type CellAlign,
  type StatGridProps,
  type StatItem,
} from './widgets/table';
export { QuizCard, dismissCard, type QuizProps } from './widgets/quiz';
export { reveal, conceal, revealAll, shake, isRevealed, type RevealOptions } from './core/anim';
export { Chart, type ChartProps, type SeriesSpec, type MarkerSpec } from './charts/chart';
export { Axis, type AxisSpec } from './charts/axis';
export { PlotMesh } from './charts/plot';
export {
  AnnotationLayer,
  type CalloutDef,
  type HotspotDef,
  type Projected,
  type Bounds,
} from './anchors/layer';
export { Callout, worldLabelSize } from './anchors/callout';
export { HotspotMarker } from './anchors/hotspot';
export { RadarChart, type RadarProps, type RadarSeries } from './charts/radar';
export { HeatMap, type HeatMapProps } from './charts/heatmap';
export { PhasorScope, type Phasor, type PhasorProps } from './charts/phasor';
export { mathMarkup } from './widgets/math';
