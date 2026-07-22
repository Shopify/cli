import {BadgeRenderer} from './badge.js'
import {BarChartRenderer} from './bar-chart.js'
import {BoxRenderer, TextRenderer} from './box.js'
import {CalloutRenderer} from './callout.js'
import {CardRenderer} from './card.js'
import {DividerRenderer} from './divider.js'
import {HeadingRenderer} from './heading.js'
import {KeyValueRenderer} from './key-value.js'
import {ListRenderer} from './list.js'
import {ListItemRenderer} from './list-item.js'
import {MarkdownRenderer} from './markdown.js'
import {MetricRenderer} from './metric.js'
import {SparklineRenderer} from './sparkline.js'
import {StatusLineRenderer} from './status-line.js'
import {TableRenderer} from './table.js'
import type {ReportComponentName} from '../catalog.js'
import type {ComponentRegistry} from '@json-render/ink'

/** cli-kit-styled replacements for every `@json-render/ink` stock renderer used by store report. */
export const reportComponents: Record<ReportComponentName, ComponentRegistry[string]> = {
  Box: BoxRenderer,
  Text: TextRenderer,
  Heading: HeadingRenderer,
  Divider: DividerRenderer,
  Badge: BadgeRenderer,
  Table: TableRenderer,
  Card: CardRenderer,
  KeyValue: KeyValueRenderer,
  StatusLine: StatusLineRenderer,
  BarChart: BarChartRenderer,
  Sparkline: SparklineRenderer,
  List: ListRenderer,
  ListItem: ListItemRenderer,
  Markdown: MarkdownRenderer,
  Metric: MetricRenderer,
  Callout: CalloutRenderer,
}
