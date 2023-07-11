import {deployConfirmationPrompt} from './prompts.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {InfoTableSection, renderConfirmationPrompt, renderSternConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/api/partners')

describe('deployConfirmationPrompt', () => {
  test('when legacy deployment mode should render confirmation prompt with the source summary', async () => {
    // Given
    vi.mocked(renderSternConfirmationPrompt).mockResolvedValue(true)

    // When
    const response = await deployConfirmationPrompt(buildSourceSummary(), 'legacy', 'apiKey', 'token', 'name')

    // Then
    expect(response).toBe(true)
    expect(renderSternConfirmationPrompt).toHaveBeenCalledWith(legacyRenderConfirmationPromptContent())
  })

  test('when unified deployment mode but without any active version should render confirmation prompt with the source summary', async () => {
    // Given
    vi.mocked(renderSternConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(partnersRequest).mockResolvedValue({app: {}})

    // When
    const response = await deployConfirmationPrompt(buildSourceSummary(), 'unified', 'apiKey', 'token', 'name')

    // Then
    expect(response).toBe(true)
    expect(renderSternConfirmationPrompt).toHaveBeenCalledWith(legacyRenderConfirmationPromptContent())
  })

  test('when unified deployment mode and an active version should render confirmation prompt with the comparison between source summary and active version', async () => {
    // Given
    vi.mocked(renderSternConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(partnersRequest).mockResolvedValue(activeVersionContent())

    // When
    const response = await deployConfirmationPrompt(buildSourceSummary(), 'unified', 'apiKey', 'token', 'name')

    // Then
    expect(response).toBe(true)
    expect(renderSternConfirmationPrompt).toHaveBeenCalledWith(unifiedRenderConfirmationPromptContent())
  })

  test('when unified deployment mode and current extension registration and active version include same dashboard extension we should show it only in the dashboard section', async () => {
    // Given
    vi.mocked(renderSternConfirmationPrompt).mockResolvedValue(true)
    vi.mocked(partnersRequest).mockResolvedValue(activeVersionContent())
    const sourceSummary = buildSourceSummary()
    sourceSummary.dashboardOnly.push({
      id: 'dashboard_id1',
      uuid: 'dashboard_uuid1',
      title: 'dashboard_title1',
      type: 'dashboard_type1',
    })

    // When
    const response = await deployConfirmationPrompt(sourceSummary, 'unified', 'apiKey', 'token', 'name')

    // Then
    // Add 'dashboard_title1' to the dashboar section
    const expectedContent = unifiedRenderConfirmationPromptContent()
    expectedContent.infoTable[0]?.items?.push(['dashboard_title1', {subdued: '(from Partner Dashboard)'}])
    // Remove 'dashboard_title1' from the deleted section
    expectedContent.infoTable[1]?.items?.pop()
    expect(response).toBe(true)
    expect(renderSternConfirmationPrompt).toHaveBeenCalledWith(expectedContent)
  })

  test('when unified deployment mode and current dashboard extension registration and non dashboard active version include same extension we should show as new, not dashboard', async () => {
    // Given
    vi.mocked(renderSternConfirmationPrompt).mockResolvedValue(true)
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
    const response = await deployConfirmationPrompt(sourceSummary, 'unified', 'apiKey', 'token', 'name')

    // Then
    // Remove dashboard section
    const expectedContent = unifiedRenderConfirmationPromptContent()
    // Add dashboard extension to the create section
    expectedContent.infoTable[0]?.items?.splice(1, 1)
    expectedContent.infoTable[0]?.items?.splice(2, 1)
    expectedContent.infoTable[0]?.items?.splice(
      1,
      0,
      ['dashboard_title2', {subdued: '(new)'}],
      ['id1', {subdued: '(new)'}],
    )
    expect(response).toBe(true)
    expect(renderSternConfirmationPrompt).toHaveBeenCalledWith(expectedContent)
  })

  test('when no removed extensions we should show selection confirmation prompt', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When
    const sourceSummary = {...buildSourceSummary(), onlyRemote: []}
    const response = await deployConfirmationPrompt(sourceSummary, 'legacy', 'apiKey', 'token', 'name')

    // Then
    expect(response).toBe(true)
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      cancellationMessage: 'No, cancel',
      confirmationMessage: 'Yes, deploy to push changes',
      infoTable: [
        {
          header: 'Includes:',
          items: [
            ['id1', {subdued: '(new)'}],
            'extension1',
            'extension2',
            ['dashboard_title2', {subdued: '(from Partner Dashboard)'}],
          ],
          bullet: '+',
        },
      ],
      message: 'question',
    })
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

function legacyRenderSelectionConfirmationPromptContent() {}

function legacyRenderConfirmationPromptContent() {
  return {
    message: 'question',
    answer: 'name',
    infoTable: [
      {
        header: 'Includes:',
        items: [
          ['id1', {subdued: '(new)'}],
          'extension1',
          'extension2',
          ['dashboard_title2', {subdued: '(from Partner Dashboard)'}],
        ],
        bullet: '+',
      },
      {
        header: 'Removes:',
        items: ['remote_title1'],
        bullet: '-',
        helperText: 'This can permanently delete app user data.',
      },
    ],
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

function unifiedRenderConfirmationPromptContent() {
  return {
    message: 'question',
    answer: 'name',
    infoTable: [
      {
        header: 'Includes:',
        items: [
          ['extension1', {subdued: '(new)'}],
          ['id1', {subdued: '(new)'}],
          'extension2',
          ['dashboard_title2', {subdued: '(from Partner Dashboard)'}],
        ],
        bullet: '+',
      },
      {
        header: 'Removes:',
        helperText: 'This can permanently delete app user data.',
        items: ['title3', 'dashboard_title1'],
        bullet: '-',
      },
    ] as InfoTableSection[],
  }
}
