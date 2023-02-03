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
