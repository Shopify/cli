import {confirmReleasePrompt} from './release.js'
import {describe, expect, vi, test} from 'vitest'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

describe('confirmReleasePrompt', () => {
  test('shows extensions in the infoTable if the diff contains added or update extensions', async () => {
    // When
    await confirmReleasePrompt('test app', {
      added: [{uuid: '2be20cc3-c102-4192-bd5c-e0aaccd25ede', registrationTitle: 'theme-app-ext'}],
      updated: [{uuid: 'abc8049d-af76-4430-84df-a6c2d8ed88aa', registrationTitle: 'sub-ui-ext'}],
      removed: [],
    })

    // Then
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: 'Release this version of test app?',
      infoTable: [
        {
          header: 'Extensions',
          items: ['theme-app-ext', 'sub-ui-ext'],
        },
      ],
      confirmationMessage: 'Yes, release this version',
      cancellationMessage: 'No, cancel',
    })
  })

  test('shows removed extensions in the infoTable if the diff contains removed extensions', async () => {
    // When
    await confirmReleasePrompt('test app', {
      added: [],
      updated: [],
      removed: [{uuid: 'abc8049d-af76-4430-84df-a6c2d8ed88aa', registrationTitle: 'sub-ui-ext'}],
    })

    // Then
    expect(renderConfirmationPrompt).toHaveBeenCalledWith({
      message: 'Release this version of test app?',
      infoTable: [
        {
          header: 'Removed',
          color: 'red',
          helperText: 'Will be removed for users when this version is released.',
          items: ['sub-ui-ext'],
        },
      ],
      confirmationMessage: 'Yes, release this version',
      cancellationMessage: 'No, cancel',
    })
  })
})
