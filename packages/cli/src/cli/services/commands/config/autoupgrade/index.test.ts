import {getAutoUpgradeStatus} from './index.js'
import * as upgrade from '@shopify/cli-kit/node/upgrade'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, expect, test, vi} from 'vitest'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

test('returns the default and persisted preferences without presenting output', async () => {
  await inTemporaryDirectory(async (directory) => {
    const storage = new LocalStorage<{sessionStore: string; autoUpgradeEnabled?: boolean}>({cwd: directory})
    const {getAutoUpgradeEnabled, setAutoUpgradeEnabled} = upgrade
    vi.spyOn(upgrade, 'getAutoUpgradeEnabled').mockImplementation(() => getAutoUpgradeEnabled(storage))
    const output = mockAndCaptureOutput()

    expect(getAutoUpgradeStatus()).toEqual({enabled: true})

    for (const enabled of [false, true]) {
      setAutoUpgradeEnabled(enabled, storage)
      expect(getAutoUpgradeStatus()).toEqual({enabled})
      const reloadedStorage = new LocalStorage<{sessionStore: string; autoUpgradeEnabled?: boolean}>({cwd: directory})
      expect(reloadedStorage.get('autoUpgradeEnabled')).toBe(enabled)
    }

    expect(output.output()).toBe('')
    expect(output.info()).toBe('')
  })
})

test('propagates a configuration read failure', () => {
  const error = new Error('Cannot read auto-upgrade preference.')
  vi.spyOn(upgrade, 'getAutoUpgradeEnabled').mockImplementation(() => {
    throw error
  })

  expect(() => getAutoUpgradeStatus()).toThrow(error)
})
