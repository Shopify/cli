import {patchAppHiddenConfigFile} from './patch-app-configuration-file.js'
import {readFile, writeFileSync, inTemporaryDirectory} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

describe('patchAppHiddenConfigFile', () => {
  test('creates a new hidden config file when it does not exist', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = joinPath(tmpDir, '.project.json')
      const clientId = '12345'
      const config = {
        dev_store_url: 'test-store.myshopify.com',
      }

      await patchAppHiddenConfigFile(configPath, clientId, config)

      const updatedJsonFile = await readFile(configPath)
      expect(JSON.parse(updatedJsonFile)).toEqual({
        '12345': {
          dev_store_url: 'test-store.myshopify.com',
        },
      })
    })
  })

  test('updates existing hidden config file with new values', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = joinPath(tmpDir, '.project.json')
      // Write initial config
      const initialConfig = {
        '12345': {
          dev_store_url: 'old-store.myshopify.com',
        },
      }
      writeFileSync(configPath, JSON.stringify(initialConfig, null, 2))

      const clientId = '12345'
      const config = {
        dev_store_url: 'new-store.myshopify.com',
      }

      await patchAppHiddenConfigFile(configPath, clientId, config)

      const updatedJsonFile = await readFile(configPath)
      expect(JSON.parse(updatedJsonFile)).toEqual({
        '12345': {
          dev_store_url: 'new-store.myshopify.com',
        },
      })
    })
  })

  test('preserves other client configurations when updating', async () => {
    await inTemporaryDirectory(async (tmpDir) => {
      const configPath = joinPath(tmpDir, '.project.json')
      // Write initial config with multiple clients
      const initialConfig = {
        '12345': {
          dev_store_url: 'store-1.myshopify.com',
        },
        '67890': {
          dev_store_url: 'store-2.myshopify.com',
        },
      }
      writeFileSync(configPath, JSON.stringify(initialConfig, null, 2))

      const clientId = '12345'
      const config = {
        dev_store_url: 'updated-store.myshopify.com',
      }

      await patchAppHiddenConfigFile(configPath, clientId, config)

      const updatedJsonFile = await readFile(configPath)
      expect(JSON.parse(updatedJsonFile)).toEqual({
        '12345': {
          dev_store_url: 'updated-store.myshopify.com',
        },
        '67890': {
          dev_store_url: 'store-2.myshopify.com',
        },
      })
    })
  })
})
