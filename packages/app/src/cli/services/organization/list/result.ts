import {organizationListJsonOutputSchema, type OrganizationListResult} from './types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

export function writeOrganizationListResult(result: OrganizationListResult, format: 'json' | 'text'): void {
  if (format === 'json') {
    outputResult(organizationListJsonOutputSchema.encode(result))
    return
  }

  renderTable({
    rows: result.organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
    })),
    columns: {
      id: {header: 'ID'},
      name: {header: 'NAME'},
    },
  })
}
