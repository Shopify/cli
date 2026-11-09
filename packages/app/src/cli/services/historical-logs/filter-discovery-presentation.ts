import {LogFiltersResult} from './filter-discovery.js'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export function renderLogFilters(result: LogFiltersResult): void {
  renderInfo({
    headline: 'App log filters.',
    customSections: result.filters.map((filter) => ({
      title: `--${filter.name}`,
      body: [
        filter.description,
        `Applies to: ${filter.applicableTypes.join(', ')}.`,
        `Value: ${filter.allowedValues?.join(' | ') ?? filter.valueFormat}.`,
        `Default: ${filter.default === null ? 'unset or described below' : String(filter.default)}. Repeatable: ${filter.repeatable ? 'yes' : 'no'}.`,
        ...(filter.dependencies.length
          ? [`Requires: ${filter.dependencies.map((name) => `--${name}`).join(', ')}.`]
          : []),
        filter.matching,
      ].join('\n'),
    })),
  })
}
