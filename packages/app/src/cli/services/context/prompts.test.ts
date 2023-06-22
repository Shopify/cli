import {deployConfirmationPrompt} from './prompts.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/api/partners')

describe('deployConfirmationPrompt', () => {
  test('when legacy deployment mode should render confirmation prompt with the source summary', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    const response = await deployConfirmationPrompt(buildSourceSummary(), 'legacy', 'apiKey', 'token')

    // Then
    expect(response).toBe(true)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith(legacyRenderConfirmationPromptContent())
  })

  test('when unified deployment mode but without any active version should render confirmation prompt with the source summary', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(partnersRequest).mockResolvedValue({app: {}})

    // When
    const response = await deployConfirmationPrompt(buildSourceSummary(), 'unified', 'apiKey', 'token')

    // Then
    expect(response).toBe(true)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith(
      legacyRenderConfirmationPromptContent('Yes, release this new version'),
    )
  })

  test('when unified deployment mode and an active version should render confirmation prompt with the comparison between source summary and active version', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(partnersRequest).mockResolvedValue(activeVersionContent())

    // When
    const response = await deployConfirmationPrompt(buildSourceSummary(), 'unified', 'apiKey', 'token')

    // Then
    expect(response).toBe(true)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith(
      unifiedRenderConfirmationPromptContent('Yes, release this new version'),
    )
  })

  test('when unified deployment mode and current extension registration and active version include same dashboard extension we should show it only in the dashboard section', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(partnersRequest).mockResolvedValue(activeVersionContent())
    const sourceSummary = buildSourceSummary()
    sourceSummary.dashboardOnly.push({
      id: 'dashboard_id1',
      uuid: 'dashboard_uuid1',
      title: 'dashboard_title1',
      type: 'dashboard_type1',
    })

    // When
    const response = await deployConfirmationPrompt(sourceSummary, 'unified', 'apiKey', 'token')

    // Then
    // Add 'dashboard_title1' to the dashboar section
    const expectedContent = unifiedRenderConfirmationPromptContent('Yes, release this new version')
    expectedContent.infoTable[2]?.items?.push('dashboard_title1')
    // Remove 'dashboard_title1' from the deleted section
    expectedContent.infoTable[3]?.items?.splice(1, 1)
    expect(response).toBe(true)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith(expectedContent)
  })

  test('when unified deployment mode and current dashboard extension registration and non dashboard active version include same extension we should not show it in the dashboard section', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(partnersRequest).mockResolvedValue(activeVersionContent())
    // Add dashboard extension to the current non dashboard registrations
    let sourceSummary = buildSourceSummary()
    sourceSummary = {
      ...sourceSummary,
      identifiers: {
        ...sourceSummary.identifiers,
        ...{dashboard_title2: 'dashboard_uuid2'},
      },
    }

    // When
    const response = await deployConfirmationPrompt(sourceSummary, 'unified', 'apiKey', 'token')

    // Then
    // Remove dashboard section
    const expectedContent = unifiedRenderConfirmationPromptContent('Yes, release this new version')
    expectedContent.infoTable.splice(2, 1)
    // Add dashboard extension to the create section
    expectedContent.infoTable[0]?.items?.splice(1, 1)
    expectedContent.infoTable[0]?.items?.push('dashboard_title2')
    expectedContent.infoTable[0]?.items?.push('id1')
    expect(response).toBe(true)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith(expectedContent)
  })
})

function buildSourceSummary() {
  return {
    question: 'question',
    identifiers: {
      extension1: 'uuid1',
      extension2: 'uuid2',
    },
    toCreate: [
      {
        localIdentifier: 'id1',
        graphQLType: 'type1',
        type: 'type1',
        configuration: {name: 'name1'},
      },
    ],
    onlyRemote: [
      {
        id: 'remote_id1',
        uuid: 'remote_uuid1',
        title: 'remote_title1',
        type: 'remote_type1',
      },
    ],
    dashboardOnly: [
      {
        id: 'dashboard_id2',
        uuid: 'dashboard_uuid2',
        title: 'dashboard_title2',
        type: 'dashboard_type2',
      },
    ],
  }
}

function legacyRenderConfirmationPromptContent(confirmationMessage = 'Yes, deploy to push changes') {
  return {
    cancellationMessage: 'No, cancel',
    confirmationMessage,
    infoTable: [
      {
        header: 'Add',
        items: ['id1'],
      },
      {
        header: 'Update',
        items: ['extension1', 'extension2'],
      },
      {
        header: `Included from\nPartner dashboard`,
        items: ['dashboard_title2'],
      },
      {
        header: 'Missing locally',
        items: ['remote_title1'],
      },
    ],
    message: 'question',
  }
}

function activeVersionContent() {
  return {
    app: {
      activeAppVersion: {
        appModuleVersions: [
          {
            registrationId: 'id3',
            registrationUuid: 'uuid3',
            registrationTitle: 'title3',
            type: 'type3',
            specification: {
              identifier: 'spec1',
              name: 'specName1',
              options: {
                managementExperience: 'cli',
              },
            },
          },
          {
            registrationId: 'id2',
            registrationUuid: 'uuid2',
            registrationTitle: 'extension2',
            type: 'type2',
            specification: {
              identifier: 'spec3',
              name: 'specName3',
              options: {
                managementExperience: 'cli',
              },
            },
          },
          {
            registrationId: 'dashboard_id1',
            registrationUuid: 'dashboard_uuid1',
            registrationTitle: 'dashboard_title1',
            type: 'admin-link',
            specification: {
              identifier: 'spec2',
              name: 'specName2',
              options: {
                managementExperience: 'dashboard',
              },
            },
          },
        ],
      },
    },
  }
}

function unifiedRenderConfirmationPromptContent(confirmationMessage = 'Yes, deploy to push changes') {
  return {
    cancellationMessage: 'No, cancel',
    confirmationMessage,
    infoTable: [
      {
        header: 'Add',
        items: ['extension1', 'id1'],
      },
      {
        header: 'Update',
        items: ['extension2'],
      },
      {
        header: `Included from\nPartner dashboard`,
        items: ['dashboard_title2'],
      },
      {
        header: 'Removed',
        helperText: 'Will be removed for users when this version is released.',
        color: 'red',
        items: ['title3', 'dashboard_title1'],
      },
    ],
    message: 'question',
  }
}
