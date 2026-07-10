import {deriveAndMergeIntercepts} from './pos_ui_extension.js'
import {POS_INTERCEPT_TARGET} from './pos_intercept_detection.js'
import {joinPath} from '@shopify/cli-kit/node/path'
import {fileURLToPath} from 'node:url'
import {dirname} from 'node:path'
import {describe, expect, test} from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const fixtureDir = joinPath(currentDir, 'fixtures', 'pos-intercept-demo')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const configWith = (capabilities?: any): any => ({
  name: 'demo',
  capabilities,
  targeting: [
    {target: POS_INTERCEPT_TARGET, module: 'src/index.ts'},
    {target: 'pos.home.tile.render', module: 'src/home-tile.ts'},
  ],
})

describe('deriveAndMergeIntercepts (deploy path)', () => {
  test('emits derived events into capabilities.intercepts when TOML declares none', async () => {
    // Given no declared intercepts, derivation alone populates the field the
    // backend reads.
    const result = await deriveAndMergeIntercepts(configWith(undefined), fixtureDir)

    expect(result?.intercepts).toContain('beforecheckout')
    expect(result?.intercepts).toContain('beforecapture')
    // Render-target event must not leak in.
    expect(result?.intercepts).not.toContain('shouldnotappear')
  })

  test('unions declared and derived events (declaration keeps working)', async () => {
    const result = await deriveAndMergeIntercepts(configWith({intercepts: ['manuallydeclared']}), fixtureDir)

    expect(result?.intercepts).toContain('manuallydeclared')
    expect(result?.intercepts).toContain('beforecheckout')
    // De-duplicated + sorted.
    expect(result?.intercepts).toEqual([...new Set(result?.intercepts)].sort())
  })

  test('falls back to declared capabilities when no intercept target is declared', async () => {
    const result = await deriveAndMergeIntercepts(
      {name: 'demo', capabilities: {intercepts: ['onlydeclared']}, targeting: []},
      fixtureDir,
    )
    expect(result?.intercepts).toEqual(['onlydeclared'])
  })
})
