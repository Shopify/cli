import {existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'fs'
import {tmpdir} from 'os'
import {join} from 'path'

// eslint-disable-next-line import-x/no-extraneous-dependencies
import {describe, expect, test} from 'vitest'

import {copyShopifyDevToolsData} from './shopify-dev-tools-data.js'

describe('copyShopifyDevToolsData', () => {
  test('copies runtime data without raw or internal schemas', () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'shopify-dev-tools-data-'))
    const sourceDataDirectory = join(temporaryDirectory, 'source')
    const targetDataDirectory = join(temporaryDirectory, 'target')

    try {
      mkdirSync(join(sourceDataDirectory, 'types', 'graphql'), {recursive: true})
      writeFileSync(join(sourceDataDirectory, 'supported-versions-schema.json'), '{}')
      writeFileSync(join(sourceDataDirectory, 'admin_2026-07.json.gz'), 'public schema')
      writeFileSync(join(sourceDataDirectory, 'admin_2026-07.json'), 'raw public schema')
      writeFileSync(join(sourceDataDirectory, 'bourgeois_unstable.json.gz'), 'internal schema')
      writeFileSync(join(sourceDataDirectory, 'types', 'index.json'), '{}')
      writeFileSync(join(sourceDataDirectory, 'types', 'graphql', 'index.d.ts.gz'), 'type declarations')
      writeFileSync(join(sourceDataDirectory, 'types', 'graphql', 'index.d.ts'), 'raw type declarations')
      mkdirSync(targetDataDirectory, {recursive: true})
      writeFileSync(join(targetDataDirectory, 'stale.json.gz'), 'stale data')

      copyShopifyDevToolsData({
        sourceDataDirectory,
        targetDataDirectory,
        internalApiIds: ['bourgeois'],
      })

      expect(existsSync(join(targetDataDirectory, 'supported-versions-schema.json'))).toBe(true)
      expect(existsSync(join(targetDataDirectory, 'admin_2026-07.json.gz'))).toBe(true)
      expect(existsSync(join(targetDataDirectory, 'admin_2026-07.json'))).toBe(false)
      expect(existsSync(join(targetDataDirectory, 'bourgeois_unstable.json.gz'))).toBe(false)
      expect(existsSync(join(targetDataDirectory, 'types', 'index.json'))).toBe(true)
      expect(existsSync(join(targetDataDirectory, 'types', 'graphql', 'index.d.ts.gz'))).toBe(true)
      expect(existsSync(join(targetDataDirectory, 'types', 'graphql', 'index.d.ts'))).toBe(false)
      expect(existsSync(join(targetDataDirectory, 'stale.json.gz'))).toBe(false)
    } finally {
      rmSync(temporaryDirectory, {recursive: true, force: true})
    }
  })
})
