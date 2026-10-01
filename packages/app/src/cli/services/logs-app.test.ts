import {resolveLogsApp} from './logs-app.js'
import {inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {expect, test, vi} from 'vitest'

vi.mock('./local-storage.js')

const account = {noPrompt: true, demo: false}

test('explicit client ID works outside an app project', async () => {
  await expect(resolveLogsApp({...account, clientId: 'selected-app', path: '/missing-project'})).resolves.toBe(
    'selected-app',
  )
})

test.each([undefined, 'staging'])('reads client ID from the selected TOML config (%s)', async (config) => {
  await inTemporaryDirectory(async (path) => {
    await writeFile(joinPath(path, 'shopify.app.toml'), 'client_id = "default-app"')
    await writeFile(joinPath(path, 'shopify.app.staging.toml'), 'client_id = "staging-app"')
    await expect(resolveLogsApp({...account, path, config})).resolves.toBe(config ? 'staging-app' : 'default-app')
  })
})

test('unlinked config reports how to select an app', async () => {
  await inTemporaryDirectory(async (path) => {
    await writeFile(joinPath(path, 'shopify.app.toml'), 'name = "Unlinked"')
    await expect(resolveLogsApp({...account, path})).rejects.toThrow('Set client_id')
  })
})

test('malformed config fails visibly', async () => {
  await inTemporaryDirectory(async (path) => {
    await writeFile(joinPath(path, 'shopify.app.toml'), 'client_id = [')
    await expect(resolveLogsApp({...account, path})).rejects.toThrow()
  })
})
