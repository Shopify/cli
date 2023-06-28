import {importFlowExtensions} from './import-flow-legacy-extensions.js'
import {testApp} from '../models/app/app.test-data.js'
import {describe, test} from 'vitest'
import {Config} from '@oclif/core'
import {inTemporaryDirectory} from '@shopify/cli-kit/node/fs'

describe('import-flow-legacy-extensions', () => {
  test('importing an extension creates a folder and toml file', async () => {
    // Given
    const app = testApp()
    const config = new Config({root: '/tmp'})

    // When
    inTemporaryDirectory(async (tmpDie) => {})
    await importFlowExtensions({app, config})

    // Then
  })
})
