import {defineCatalog} from '@json-render/core'
import {schema, standardComponentDefinitions, type ComponentDefinition} from '@json-render/ink/server'

export const REPORT_COMPONENT_NAMES = [
  'Box',
  'Text',
  'Heading',
  'Divider',
  'Badge',
  'Table',
  'Card',
  'KeyValue',
  'StatusLine',
  'BarChart',
  'Sparkline',
  'List',
  'ListItem',
  'Markdown',
  'Metric',
  'Callout',
] as const

export type ReportComponentName = (typeof REPORT_COMPONENT_NAMES)[number]

/** The complete display-only component surface available to generated store reports. */
export const reportComponentDefinitions = {
  Box: standardComponentDefinitions.Box,
  Text: standardComponentDefinitions.Text,
  Heading: standardComponentDefinitions.Heading,
  Divider: standardComponentDefinitions.Divider,
  Badge: standardComponentDefinitions.Badge,
  Table: standardComponentDefinitions.Table,
  Card: standardComponentDefinitions.Card,
  KeyValue: standardComponentDefinitions.KeyValue,
  StatusLine: standardComponentDefinitions.StatusLine,
  BarChart: standardComponentDefinitions.BarChart,
  Sparkline: standardComponentDefinitions.Sparkline,
  List: standardComponentDefinitions.List,
  ListItem: standardComponentDefinitions.ListItem,
  Markdown: standardComponentDefinitions.Markdown,
  Metric: standardComponentDefinitions.Metric,
  Callout: standardComponentDefinitions.Callout,
} satisfies Record<ReportComponentName, ComponentDefinition>

export const reportCatalog = defineCatalog(schema, {
  components: reportComponentDefinitions,
  actions: {},
})
