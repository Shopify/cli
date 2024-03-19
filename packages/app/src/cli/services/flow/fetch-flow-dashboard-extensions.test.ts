import {getActiveDashboardExtensions} from './fetch-flow-dashboard-extensions.js'
import {testDeveloperPlatformClient} from '../../models/app/app.test-data.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../../api/graphql/all_app_extension_registrations.js'
import {MinimalAppIdentifiers} from '../../models/organization.js'
import {describe, expect, vi} from 'vitest'

vi.mock('../dev/fetch')

describe('getActiveDashboardExtensions', (it) => {
  it('should return only flow extensions with any version', async () => {
    // Given
    const appExtensionRegistrations: AllAppExtensionRegistrationsQuerySchema = {
      app: {
        extensionRegistrations: [],
        configurationRegistrations: [],
        dashboardManagedExtensionRegistrations: [
          {
            id: 'id-1',
            title: 'title-1',
            uuid: 'uuid-1',
            type: 'flow_action_definition',
            activeVersion: {
              config: '{}',
            },
          },
          {
            id: 'id-2',
            title: 'title-2',
            uuid: 'uuid-2',
            type: 'flow_trigger_definition',
            draftVersion: {
              config: '{}',
            },
          },
          {
            id: 'id-3',
            title: 'title-3',
            uuid: 'uuid-3',
            type: 'flow_action_definition',
          },
          {
            id: 'id-4',
            title: 'title-4',
            uuid: 'uuid-4',
            type: 'any_other_type',
            activeVersion: {
              config: '{}',
            },
          },
        ],
      },
    }
    const developerPlatformClient = testDeveloperPlatformClient({
      appExtensionRegistrations: (_app: MinimalAppIdentifiers) => Promise.resolve(appExtensionRegistrations),
    })

    // When
    const got = await getActiveDashboardExtensions({developerPlatformClient, apiKey: 'apiKey', organizationId: '1'})

    // Then
    expect(got).toEqual([
      {
        id: 'id-1',
        title: 'title-1',
        uuid: 'uuid-1',
        type: 'flow_action_definition',
        activeVersion: {
          config: '{}',
        },
      },
      {
        id: 'id-2',
        title: 'title-2',
        uuid: 'uuid-2',
        type: 'flow_trigger_definition',
        draftVersion: {
          config: '{}',
        },
      },
    ])
  })
})
