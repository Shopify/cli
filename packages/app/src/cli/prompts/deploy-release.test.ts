import {buildConfigurationBreakdownMetadata, deployOrReleaseConfirmationPrompt} from './deploy-release.js'
import metadata from '../metadata.js'
import {
  ConfigExtensionIdentifiersBreakdown,
  ExtensionIdentifiersBreakdown,
  buildDashboardBreakdownInfo,
  buildExtensionBreakdownInfo,
} from '../services/context/breakdown-extensions.js'
import {SpyInstance, describe, expect, test, vi} from 'vitest'
import * as ui from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/context/local')

describe('deployOrReleaseConfirmationPrompt', () => {
  describe('when release', () => {
    test('and force no prompt should be displayed and true returned', async () => {
      // Given
      const {extensionIdentifiersBreakdown, configExtensionIdentifiersBreakdown} = buildCompleteBreakdownInfo()
      const renderConfirmationPromptSpyOn = vi.spyOn(ui, 'renderConfirmationPrompt')
      const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})
      const appTitle = 'app title'

      // When
      const result = await deployOrReleaseConfirmationPrompt({
        extensionIdentifiersBreakdown,
        configExtensionIdentifiersBreakdown,
        appTitle,
        release: true,
        force: true,
      })

      // Then
      verifyMetada({
        metadataSpyOn,
        confirmed: result,
        configExtensionIdentifiersBreakdown: configExtensionIdentifiersBreakdown!,
      })
      expect(renderConfirmationPromptSpyOn).not.toHaveBeenCalled()
      expect(result).toBe(true)
    })

    test('and no force without any modifications either extension or config should not display sections', async () => {
      // Given
      const extensionIdentifiersBreakdown = buildEmptyExtensionsBreakdownInfo()
      const configExtensionIdentifiersBreakdown = buildEmptyConfigExtensionsBreakdownInfo()

      const renderConfirmationPromptSpyOn = vi.spyOn(ui, 'renderConfirmationPrompt').mockResolvedValue(true)
      const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})
      const appTitle = 'app title'

      // When
      const result = await deployOrReleaseConfirmationPrompt({
        extensionIdentifiersBreakdown,
        configExtensionIdentifiersBreakdown,
        appTitle,
        release: true,
        force: false,
      })

      // Then
      verifyMetada({
        metadataSpyOn,
        extensionIdentifiersBreakdown,
        confirmed: result,
        configExtensionIdentifiersBreakdown,
      })
      expect(renderConfirmationPromptSpyOn).toHaveBeenCalledWith(
        renderConfirmationPromptContent({
          appTitle,
          infoTable: [],
          dangerPrompt: false,
        }),
      )
      expect(result).toBe(true)
    })

    test('and no force without extensions deleted should display the complete confirmation prompt', async () => {
      // Given
      const breakdownInfo = buildCompleteBreakdownInfo()
      breakdownInfo.extensionIdentifiersBreakdown.onlyRemote = []

      const renderConfirmationPromptSpyOn = vi.spyOn(ui, 'renderConfirmationPrompt').mockResolvedValue(true)
      const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})
      const appTitle = 'app title'

      // When
      const result = await deployOrReleaseConfirmationPrompt({
        ...breakdownInfo,
        appTitle,
        release: true,
        force: false,
      })

      // Then
      verifyMetada({
        metadataSpyOn,
        extensionIdentifiersBreakdown: breakdownInfo.extensionIdentifiersBreakdown,
        confirmed: result,
        configExtensionIdentifiersBreakdown: breakdownInfo.configExtensionIdentifiersBreakdown!,
      })
      expect(renderConfirmationPromptSpyOn).toHaveBeenCalledWith(
        renderConfirmationPromptContent({
          appTitle,
          infoTable: [
            {
              header: 'Configuration:',
              items: [
                {bullet: '+', item: ['new field name1', {subdued: '(new)'}], color: 'green'},
                {item: ['updating field name1', {subdued: '(updated)'}], color: '#FF8800'},
                'existing field name1',
                {bullet: '-', item: ['deleted field name1', {subdued: '(removed)'}], color: 'red'},
              ],
            },
            {
              header: 'Extensions:',
              items: [
                {bullet: '+', item: ['to create extension', {subdued: '(new)'}], color: 'green'},
                'to update extension',
                ['from dashboard extension', {subdued: '(from Partner Dashboard)'}],
              ],
            },
          ],
          dangerPrompt: false,
        }),
      )
      expect(result).toBe(true)
    })

    test('and no force with deleted extensions should display the complete danger confirmation prompt', async () => {
      // Given
      const breakdownInfo = buildCompleteBreakdownInfo()
      breakdownInfo.extensionIdentifiersBreakdown.onlyRemote.push(buildDashboardBreakdownInfo('remote dashboard'))
      breakdownInfo.extensionIdentifiersBreakdown.toCreate.push(buildDashboardBreakdownInfo('to create dashboard'))
      const renderDangerousConfirmationPromptSpyOn = vi
        .spyOn(ui, 'renderDangerousConfirmationPrompt')
        .mockResolvedValue(true)
      const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})
      const appTitle = 'app title'

      // When
      const result = await deployOrReleaseConfirmationPrompt({
        ...breakdownInfo,
        appTitle,
        release: true,
        force: false,
      })

      // Then
      verifyMetada({
        metadataSpyOn,
        extensionIdentifiersBreakdown: breakdownInfo.extensionIdentifiersBreakdown,
        confirmed: result,
        configExtensionIdentifiersBreakdown: breakdownInfo.configExtensionIdentifiersBreakdown!,
      })
      expect(renderDangerousConfirmationPromptSpyOn).toHaveBeenCalledWith(
        renderConfirmationPromptContent({
          appTitle,
          infoTable: [
            {
              header: 'Configuration:',
              items: [
                {bullet: '+', item: ['new field name1', {subdued: '(new)'}], color: 'green'},
                {item: ['updating field name1', {subdued: '(updated)'}], color: '#FF8800'},
                'existing field name1',
                {bullet: '-', item: ['deleted field name1', {subdued: '(removed)'}], color: 'red'},
              ],
            },
            {
              header: 'Extensions:',
              helperText: 'Removing extensions can permanentely delete app user data',
              items: [
                {bullet: '+', item: ['to create extension', {subdued: '(new)'}], color: 'green'},
                {
                  bullet: '+',
                  item: ['to create dashboard', {subdued: '(new, from Partner Dashboard)'}],
                  color: 'green',
                },
                'to update extension',
                ['from dashboard extension', {subdued: '(from Partner Dashboard)'}],
                {bullet: '-', item: ['remote extension', {subdued: '(removed)'}], color: 'red'},
                {bullet: '-', item: ['remote dashboard', {subdued: '(removed, from Partner Dashboard)'}], color: 'red'},
              ],
            },
          ],
          dangerPrompt: true,
        }),
      )
      expect(result).toBe(true)
    })

    test('and no force with deleted extensions but without app title should display the complete confirmation prompt', async () => {
      // Given
      const breakdownInfo = buildCompleteBreakdownInfo()

      const renderConfirmationPromptSpyOn = vi.spyOn(ui, 'renderConfirmationPrompt').mockResolvedValue(true)
      const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})
      const appTitle = undefined

      // When
      const result = await deployOrReleaseConfirmationPrompt({
        ...breakdownInfo,
        release: true,
        force: false,
      })

      // Then
      verifyMetada({
        metadataSpyOn,
        extensionIdentifiersBreakdown: breakdownInfo.extensionIdentifiersBreakdown,
        confirmed: result,
        configExtensionIdentifiersBreakdown: breakdownInfo.configExtensionIdentifiersBreakdown!,
      })
      expect(renderConfirmationPromptSpyOn).toHaveBeenCalledWith(
        renderConfirmationPromptContent({
          appTitle,
          infoTable: [
            {
              header: 'Configuration:',
              items: [
                {bullet: '+', item: ['new field name1', {subdued: '(new)'}], color: 'green'},
                {item: ['updating field name1', {subdued: '(updated)'}], color: '#FF8800'},
                'existing field name1',
                {bullet: '-', item: ['deleted field name1', {subdued: '(removed)'}], color: 'red'},
              ],
            },
            {
              header: 'Extensions:',
              items: [
                {bullet: '+', item: ['to create extension', {subdued: '(new)'}], color: 'green'},
                'to update extension',
                ['from dashboard extension', {subdued: '(from Partner Dashboard)'}],
                {bullet: '-', item: ['remote extension', {subdued: '(removed)'}], color: 'red'},
              ],
            },
          ],
          dangerPrompt: false,
        }),
      )
      expect(result).toBe(true)
    })

    test('and the configuration extension breakdown is undefined then the config information should not be displayed', async () => {
      // Given
      const breakdownInfo = buildCompleteBreakdownInfo()
      breakdownInfo.configExtensionIdentifiersBreakdown = undefined

      const renderConfirmationPromptSpyOn = vi.spyOn(ui, 'renderConfirmationPrompt').mockResolvedValue(true)
      const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})
      const appTitle = undefined

      // When
      const result = await deployOrReleaseConfirmationPrompt({
        ...breakdownInfo,
        release: true,
        force: false,
        showConfig: false,
      })

      // Then
      verifyMetada({
        metadataSpyOn,
        extensionIdentifiersBreakdown: breakdownInfo.extensionIdentifiersBreakdown,
        confirmed: result,
        configExtensionIdentifiersBreakdown: breakdownInfo.configExtensionIdentifiersBreakdown!,
      })
      expect(renderConfirmationPromptSpyOn).toHaveBeenCalledWith(
        renderConfirmationPromptContent({
          appTitle,
          infoTable: [
            {
              header: 'Extensions:',
              items: [
                {bullet: '+', item: ['to create extension', {subdued: '(new)'}], color: 'green'},
                'to update extension',
                ['from dashboard extension', {subdued: '(from Partner Dashboard)'}],
                {bullet: '-', item: ['remote extension', {subdued: '(removed)'}], color: 'red'},
              ],
            },
          ],
          dangerPrompt: false,
        }),
      )
      expect(result).toBe(true)
    })

    test('and no force without config modification should display the no config changes confirmation prompt', async () => {
      // Given
      const breakdownInfo = buildCompleteBreakdownInfo()
      breakdownInfo.configExtensionIdentifiersBreakdown = buildEmptyConfigExtensionsBreakdownInfo()

      const renderDangerousConfirmationPromptSpyOn = vi
        .spyOn(ui, 'renderDangerousConfirmationPrompt')
        .mockResolvedValue(true)
      const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})
      const appTitle = 'app title'

      // When
      const result = await deployOrReleaseConfirmationPrompt({
        ...breakdownInfo,
        appTitle,
        release: true,
        force: false,
      })

      // Then
      verifyMetada({
        metadataSpyOn,
        extensionIdentifiersBreakdown: breakdownInfo.extensionIdentifiersBreakdown,
        confirmed: result,
        configExtensionIdentifiersBreakdown: breakdownInfo.configExtensionIdentifiersBreakdown,
      })
      expect(renderDangerousConfirmationPromptSpyOn).toHaveBeenCalledWith(
        renderConfirmationPromptContent({
          appTitle,
          infoTable: [
            {
              header: 'Configuration:',
              items: [],
              emptyItemsText: 'No changes',
            },
            {
              header: 'Extensions:',
              helperText: 'Removing extensions can permanentely delete app user data',
              items: [
                {bullet: '+', item: ['to create extension', {subdued: '(new)'}], color: 'green'},
                'to update extension',
                ['from dashboard extension', {subdued: '(from Partner Dashboard)'}],
                {bullet: '-', item: ['remote extension', {subdued: '(removed)'}], color: 'red'},
              ],
            },
          ],
          dangerPrompt: true,
        }),
      )
      expect(result).toBe(true)
    })
  })

  describe('when no release', () => {
    test('and no force without extensions deleted should display the complete confirmation prompt', async () => {
      // Given
      const breakdownInfo = buildCompleteBreakdownInfo()
      breakdownInfo.extensionIdentifiersBreakdown.onlyRemote = []

      const renderConfirmationPromptSpyOn = vi.spyOn(ui, 'renderConfirmationPrompt').mockResolvedValue(true)
      const metadataSpyOn = vi.spyOn(metadata, 'addPublicMetadata').mockImplementation(async () => {})
      const appTitle = 'app title'

      // When
      const result = await deployOrReleaseConfirmationPrompt({
        ...breakdownInfo,
        appTitle,
        release: false,
        force: false,
      })

      // Then
      verifyMetada({
        metadataSpyOn,
        extensionIdentifiersBreakdown: breakdownInfo.extensionIdentifiersBreakdown,
        confirmed: result,
        configExtensionIdentifiersBreakdown: breakdownInfo.configExtensionIdentifiersBreakdown!,
      })
      expect(renderConfirmationPromptSpyOn).toHaveBeenCalledWith(
        renderConfirmationPromptContent({
          appTitle,
          infoTable: [
            {
              header: 'Configuration:',
              items: [
                {bullet: '+', item: ['new field name1', {subdued: '(new)'}], color: 'green'},
                {item: ['updating field name1', {subdued: '(updated)'}], color: '#FF8800'},
                'existing field name1',
                {bullet: '-', item: ['deleted field name1', {subdued: '(removed)'}], color: 'red'},
              ],
            },
            {
              header: 'Extensions:',
              items: [
                {bullet: '+', item: ['to create extension', {subdued: '(new)'}], color: 'green'},
                'to update extension',
                ['from dashboard extension', {subdued: '(from Partner Dashboard)'}],
              ],
            },
          ],
          dangerPrompt: false,
          confirmationMessage: 'Yes, create this new version',
          message: 'Create a new version of app title?',
        }),
      )
      expect(result).toBe(true)
    })
  })
})

interface RenderConfirmationPromptContentOptions {
  infoTable?: ui.InfoTableSection[]
  appTitle?: string
  message?: string
  dangerPrompt?: boolean
  confirmationMessage?: string
}

function renderConfirmationPromptContent(options: RenderConfirmationPromptContentOptions = {}) {
  const {infoTable, message, dangerPrompt, appTitle, confirmationMessage} = options

  return {
    ...(dangerPrompt ? {} : {cancellationMessage: 'No, cancel'}),
    ...(dangerPrompt ? {} : {confirmationMessage: confirmationMessage ?? 'Yes, release this new version'}),
    ...(dangerPrompt ? {confirmation: appTitle} : {}),
    infoTable,
    message: message ?? `Release a new version${appTitle ? ` of ${appTitle}` : ''}?`,
  }
}

function buildCompleteBreakdownInfo() {
  const emptyBreakdownInfo = buildEmptyBreakdownInfo()

  emptyBreakdownInfo.extensionIdentifiersBreakdown.onlyRemote.push(buildExtensionBreakdownInfo('remote extension'))
  emptyBreakdownInfo.extensionIdentifiersBreakdown.toCreate.push(buildExtensionBreakdownInfo('to create extension'))
  emptyBreakdownInfo.extensionIdentifiersBreakdown.toUpdate.push(
    buildExtensionBreakdownInfo('to update extension'),
    buildDashboardBreakdownInfo('from dashboard extension'),
  )

  emptyBreakdownInfo.configExtensionIdentifiersBreakdown!.existingFieldNames.push('existing field name1')
  emptyBreakdownInfo.configExtensionIdentifiersBreakdown!.existingUpdatedFieldNames.push('updating field name1')
  emptyBreakdownInfo.configExtensionIdentifiersBreakdown!.newFieldNames.push('new field name1')
  emptyBreakdownInfo.configExtensionIdentifiersBreakdown!.deletedFieldNames.push('deleted field name1')

  return emptyBreakdownInfo
}

function buildEmptyBreakdownInfo(): {
  extensionIdentifiersBreakdown: ExtensionIdentifiersBreakdown
  configExtensionIdentifiersBreakdown?: ConfigExtensionIdentifiersBreakdown
} {
  return {
    extensionIdentifiersBreakdown: buildEmptyExtensionsBreakdownInfo(),
    configExtensionIdentifiersBreakdown: buildEmptyConfigExtensionsBreakdownInfo(),
  }
}

function buildEmptyExtensionsBreakdownInfo(): ExtensionIdentifiersBreakdown {
  return {
    onlyRemote: [],
    toCreate: [],
    toUpdate: [],
  }
}

function buildEmptyConfigExtensionsBreakdownInfo(): ConfigExtensionIdentifiersBreakdown {
  return {
    existingFieldNames: [],
    existingUpdatedFieldNames: [],
    newFieldNames: [],
    deletedFieldNames: [],
  }
}

function verifyMetada({
  metadataSpyOn,
  extensionIdentifiersBreakdown,
  confirmed,
  configExtensionIdentifiersBreakdown,
}: {
  metadataSpyOn: SpyInstance
  extensionIdentifiersBreakdown?: ExtensionIdentifiersBreakdown
  confirmed: boolean
  configExtensionIdentifiersBreakdown: ConfigExtensionIdentifiersBreakdown
}) {
  const configurationBreakdownMetadata = buildConfigurationBreakdownMetadata(configExtensionIdentifiersBreakdown)

  expect(metadataSpyOn).toHaveBeenNthCalledWith(1, expect.any(Function))
  expect(metadataSpyOn.mock.calls[0]![0]()).toEqual(configurationBreakdownMetadata)

  if (!extensionIdentifiersBreakdown) return

  expect(metadataSpyOn).toHaveBeenNthCalledWith(2, expect.any(Function))
  expect(metadataSpyOn.mock.calls[1]![0]()).toEqual({
    cmd_deploy_confirm_new_registrations: extensionIdentifiersBreakdown.toCreate.length,
    cmd_deploy_confirm_updated_registrations: extensionIdentifiersBreakdown.toUpdate.length,
    cmd_deploy_confirm_removed_registrations: extensionIdentifiersBreakdown.onlyRemote.length,
  })
  expect(metadataSpyOn).toHaveBeenNthCalledWith(3, expect.any(Function))
  expect(metadataSpyOn.mock.calls[2]![0]()).toEqual(
    expect.objectContaining({
      cmd_deploy_confirm_cancelled: !confirmed,
    }),
  )
}
