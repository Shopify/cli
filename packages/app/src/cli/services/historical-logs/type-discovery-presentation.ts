import {LogTypesResult} from './type-discovery.js'
import {renderInfo, renderTable} from '@shopify/cli-kit/node/ui'

export function renderLogTypes(result: LogTypesResult, detailed: boolean): void {
  if (!detailed) {
    renderTable({
      rows: result.types.map(({name, description}) => ({name, description})),
      columns: {name: {header: 'Type'}, description: {header: 'Description'}},
    })
    return
  }

  for (const type of result.types) {
    renderInfo({
      headline: type.name,
      body: type.description,
      customSections: [
        {title: 'Filters', body: type.filters.map((filter) => ({command: `--${filter}`}))},
        {title: 'Limitations', body: {list: {items: type.limitations}}},
        {title: 'Example', body: {command: type.example}},
      ],
    })
  }
}
