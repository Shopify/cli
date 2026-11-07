import {configureAutoUpgrade, getAutoUpgradeStatus} from './index.js'
import * as upgrade from '@shopify/cli-kit/node/upgrade'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {mockAndCaptureOutput} from '@shopify/cli-kit/node/testing/output'
import {afterEach, expect, test, vi} from 'vitest'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

test('returns the default preference and persists each configured value without presenting output', async () => {
  await inTemporaryDirectory(async (directory) => {
    const storage = new LocalStorage<{sessionStore: string; autoUpgradeEnabled?: boolean}>({cwd: directory})
    const {getAutoUpgradeEnabled, setAutoUpgradeEnabled} = upgrade
    vi.spyOn(upgrade, 'getAutoUpgradeEnabled').mockImplementation(() => getAutoUpgradeEnabled(storage))
    vi.spyOn(upgrade, 'setAutoUpgradeEnabled').mockImplementation((enabled) => setAutoUpgradeEnabled(enabled, storage))
    const output = mockAndCaptureOutput()

    expect(getAutoUpgradeStatus()).toEqual({enabled: true})

    for (const enabled of [false, true]) {
      expect(configureAutoUpgrade(enabled)).toEqual({enabled})
      expect(getAutoUpgradeStatus()).toEqual({enabled})
      const reloadedStorage = new LocalStorage<{sessionStore: string; autoUpgradeEnabled?: boolean}>({cwd: directory})
      expect(reloadedStorage.get('autoUpgradeEnabled')).toBe(enabled)
    }

    expect(output.output()).toBe('')
    expect(output.info()).toBe('')
  })
})

test('propagates a configuration write failure', () => {
  const error = new Error('Cannot save auto-upgrade preference.')
  vi.spyOn(upgrade, 'setAutoUpgradeEnabled').mockImplementation(() => {
    throw error
  })

  expect(() => configureAutoUpgrade(false)).toThrow(error)
})

test('propagates a configuration read failure', () => {
  const error = new Error('Cannot read auto-upgrade preference.')
  vi.spyOn(upgrade, 'getAutoUpgradeEnabled').mockImplementation(() => {
    throw error
  })

  expect(() => getAutoUpgradeStatus()).toThrow(error)
})
