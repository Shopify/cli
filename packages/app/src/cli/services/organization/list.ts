import {fetchOrganizations, NoOrgError} from '../dev/fetch.js'
import {Organization} from '../../models/organization.js'
import {organizationGidForBP} from '../../utilities/developer-platform-client/app-management-client.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderTable} from '@shopify/cli-kit/node/ui'

interface OrganizationListOptions {
  json: boolean
}

export async function organizationList(options: OrganizationListOptions): Promise<void> {
  let organizations: Organization[]
  try {
    organizations = await fetchOrganizations()
  } catch (error) {
    // In JSON mode, return empty array for CI/agents instead of throwing
    if (options.json && error instanceof NoOrgError) {
      outputResult(JSON.stringify({organizations: []}, null, 2))
      return
    }
    throw error
  }

  if (options.json) {
    const jsonOutput = {
      organizations: organizations.map((org) => ({
        id: org.id,
        gid: organizationGidForBP(org.id),
        name: org.businessName,
      })),
    }
    outputResult(JSON.stringify(jsonOutput, null, 2))
    return
  }

  renderOrganizationsTable(organizations)
}

function renderOrganizationsTable(organizations: Organization[]): void {
  const rows = organizations.map((org) => ({
    id: org.id,
    name: org.businessName,
  }))

  renderTable({
    rows,
    columns: {
      id: {header: 'ID'},
      name: {header: 'NAME'},
    },
  })
}
