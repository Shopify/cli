import {deriveAndMergeIntercepts} from './pos_ui_extension.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileURLToPath} from 'node:url'
import {dirname} from 'node:path'
import {describe, expect, test} from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const fixtureDir = joinPath(currentDir, 'fixtures', 'pos-intercept-demo')

describe('deriveAndMergeIntercepts (deploy path)', () => {
  test('emits derived events into capabilities.intercepts when TOML declares none', async () => {
    // Given no declared intercepts, derivation alone populates the field the
    // backend reads.
    const result = await deriveAndMergeIntercepts(undefined, fixtureDir)

    expect(result?.intercepts).toContain('beforecheckout')
    expect(result?.intercepts).toContain('beforecapture')
  })

  test('unions declared and derived events (declaration keeps working)', async () => {
    const result = await deriveAndMergeIntercepts({intercepts: ['manuallydeclared']}, fixtureDir)

    expect(result?.intercepts).toContain('manuallydeclared')
    expect(result?.intercepts).toContain('beforecheckout')
    // De-duplicated + sorted.
    expect(result?.intercepts).toEqual([...new Set(result?.intercepts)].sort())
  })

  test('falls back to declared capabilities when no entry file exists', async () => {
    const result = await deriveAndMergeIntercepts({intercepts: ['onlydeclared']}, '/tmp/does-not-exist-xyz')
    expect(result?.intercepts).toEqual(['onlydeclared'])
  })
})
