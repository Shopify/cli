import {replaceArrayStrategy} from './patch-app-configuration-file.js'
import {updateTomlValues} from './toml-patch-wasm.js'
import {decodeToml, encodeToml} from '@shopify/cli-kit/node/toml'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'
import {describe, bench} from 'vitest'

// Sample TOML content for testing
const sampleToml = `
# This is a sample TOML file
title = "TOML Example"

[owner]
name = "Test User"
organization = "Test Org"

[database]
server = "192.168.1.1"
ports = [ 8001, 8001, 8002 ] # Comment after array
enabled = true
`

function createPatchFromDottedPath(keyPath: string, value: unknown): {[key: string]: unknown} {
  const keys = keyPath.split('.')
  if (keys.length === 1) {
    return {[keyPath]: value}
  }

  const obj: {[key: string]: unknown} = {}
  let currentObj = obj

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (key) {
      currentObj[key] = {}
      currentObj = currentObj[key] as {[key: string]: unknown}
    }
  }

  const lastKey = keys[keys.length - 1]
  if (lastKey) {
    currentObj[lastKey] = value
  }

  return obj
}

describe('WASM TOML Patch Integration', () => {
  bench('time how long to update TOML, using WASM wrapper', async () => {
    await updateTomlValues(sampleToml, [
      [['owner', 'dotted', 'notation'], 123.5],
      [['database', 'server'], 'changed'],
      [['top_level'], true],
    ])
  })

  bench('time how long to update TOML, using plain JS', async () => {
    const configValues = [
      ['owner.dotted.notation', 123.5],
      ['database.server', 'changed'],
      ['top_level', true],
    ] as const
    const patch = configValues.reduce((acc, [keyPath, value]) => {
      const valuePatch = createPatchFromDottedPath(keyPath, value)
      return deepMergeObjects(acc, valuePatch, replaceArrayStrategy)
    }, {})

    const configuration = decodeToml(sampleToml)
    const updatedConfig = deepMergeObjects(configuration, patch, replaceArrayStrategy)
    encodeToml(updatedConfig)
  })
})
