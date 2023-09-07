import {confirmReleasePrompt} from './release.js'
import {testApp} from '../models/app/app.test-data.js'
import {ExtensionSpecification} from '../models/extensions/specification.js'
import {describe, expect, vi, test} from 'vitest'
import {renderConfirmationPrompt, renderDangerousConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

vi.mock('@shopify/cli-kit/node/ui')

describe('confirmReleasePrompt', () => {
  const defaultApp = testApp(undefined, undefined, [
    {
      identifier: 'theme',
      appModuleFeatures() {
        return []
      },
    } as unknown as ExtensionSpecification,
    {
      identifier: 'product_subscription',
      appModuleFeatures() {
        return []
      },
    } as unknown as ExtensionSpecification,
    {
      identifier: 'product_subscription',
      appModuleFeatures() {
        return []
      },
    } as unknown as ExtensionSpecification,
    {
      identifier: 'app_access',
      appModuleFeatures() {
        return ['app_config']
      },
    } as unknown as ExtensionSpecification,
    {
      identifier: 'another_app_config',
      appModuleFeatures() {
        return ['app_config']
      },
    } as unknown as ExtensionSpecification,
  ])

  test('shows extensions in the infoTable if the diff contains added or update extensions, excluding app config modules', async () => {
    // Given
    vi.mocked(renderConfirmationPrompt).mockResolvedValue(true)

    // When / Then
    await expect(
      confirmReleasePrompt(
        'test app',
        {
          added: [
            {
              uuid: '2be20cc3-c102-4192-bd5c-e0aaccd25ede',
              registrationTitle: 'theme-app-ext',
              specification: {identifier: 'theme'},
            },
            {
              uuid: '2be20cc3-c102-4192-bd5c-e0aaccd25abc',
              registrationTitle: 'app-access',
              specification: {identifier: 'app_access'},
            },
          ],
          updated: [
            {
              uuid: 'abc8049d-af76-4430-84df-a6c2d8ed88aa',
              registrationTitle: 'sub-ui-ext',
              specification: {identifier: 'product_subscription'},
            },
            {
              uuid: '2be20cc3-c102-4192-bd5c-e0aaccd25def',
              registrationTitle: 'another-app-config',
              specification: {identifier: 'another_app_config'},
            },
          ],
          removed: [],
        },
        defaultApp,
      ),
    ).resolves
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: 'Release this version of test app?',
      infoTable: [
        {
          header: 'Includes:',
          items: ['theme-app-ext', 'sub-ui-ext'],
          bullet: '+',
        },
      ],
      confirmationMessage: 'Yes, release this version',
      cancellationMessage: 'No, cancel',
    })
  })

  test('shows removed extensions in the infoTable if the diff contains removed extensions, excluding app config modules', async () => {
    // Given
    vi.mocked(renderDangerousConfirmationPrompt).mockResolvedValue(true)

    // When / Then
    await expect(
      confirmReleasePrompt(
        'test app',
        {
          added: [],
          updated: [],
          removed: [
            {
              uuid: 'abc8049d-af76-4430-84df-a6c2d8ed88aa',
              registrationTitle: 'sub-ui-ext',
              specification: {identifier: 'product_subscription'},
            },
            {
              uuid: '2be20cc3-c102-4192-bd5c-e0aaccd25abc',
              registrationTitle: 'app-access',
              specification: {identifier: 'app_access'},
            },
          ],
        },
        defaultApp,
      ),
    ).resolves

    expect(renderDangerousConfirmationPrompt).toHaveBeenCalledWith({
      message: 'Release this version of test app?',
      infoTable: [
        {
          header: 'Removes:',
          helperText: 'This can permanently delete app user data.',
          items: ['sub-ui-ext'],
          bullet: '-',
        },
      ],
      confirmation: 'test app',
    })
  })

  test('throws a silent exception in case the user rejects the release prompt', async () => {
    // Given
    vi.mocked(renderDangerousConfirmationPrompt).mockResolvedValue(false)

    // When/ Then
    await expect(
      confirmReleasePrompt(
        'test app',
        {
          added: [],
          updated: [],
          removed: [],
        },
        defaultApp,
      ),
    ).rejects.toThrow(AbortSilentError)
  })
})
