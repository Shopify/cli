import {TableColumn} from '@shopify/cli-kit/node/ui'

export const columns: TableColumn<{[key in 'name' | 'role' | 'id']: unknown}> = {
  name: {},
  role: {
    color: 'dim',
  },
  id: {
    color: 'dim',
  },
}

export function filteredColumns(only: 'name' | 'id' | undefined, columns: TableColumn<{[p: string]: unknown}>) {
  if (!only) {
    return columns
  }
  const single: TableColumn<{[p: string]: unknown}> = {}
  single[only] = columns[only] as {[p: string]: unknown}
  return single
}
