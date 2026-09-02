import {findDataDir} from '../data-loader.js'
import {describe, expect, test} from 'vitest'

// `findDataDir` is a pure ancestor walk: `startDir` and `exists` are injected, so
// these tests need no real filesystem. It is the single shared resolver every
// data-backed subcommand uses; `dataSubdir` is the subcommand leaf directory
// (`components`, `graphql`, `functions`) probed under `assets/validate/` then
// `dist/assets/validate/`.

describe('findDataDir', () => {
  const componentsMarker = ['types', 'index.json'] as const

  test('prefers assets/ over dist/assets/ at the same ancestor', () => {
    const existing = new Set(['/repo/assets/validate/components/types/index.json'])
    const found = findDataDir('/repo/src/cli/services', 'components', componentsMarker, (path) => existing.has(path))

    expect(found).toBe('/repo/assets/validate/components')
  })

  test('falls back to dist/assets/ when assets/ is absent', () => {
    const existing = new Set(['/repo/dist/assets/validate/components/types/index.json'])
    const found = findDataDir('/repo/dist/cli/services', 'components', componentsMarker, (path) => existing.has(path))

    expect(found).toBe('/repo/dist/assets/validate/components')
  })

  test('walks up ancestors until the marker is found', () => {
    const existing = new Set(['/repo/assets/validate/components/types/index.json'])
    const found = findDataDir(
      '/repo/src/cli/services/validate/engine/components',
      'components',
      componentsMarker,
      (path) => existing.has(path),
    )

    expect(found).toBe('/repo/assets/validate/components')
  })

  test('returns undefined when the marker is never found', () => {
    const found = findDataDir('/repo/src', 'components', componentsMarker, () => false)

    expect(found).toBeUndefined()
  })

  test('resolves the graphql/functions subdir via the catalog marker', () => {
    const catalogMarker = ['supported-versions-schema.json'] as const
    const existing = new Set(['/repo/assets/validate/graphql/supported-versions-schema.json'])
    const found = findDataDir('/repo/src/cli/services', 'graphql', catalogMarker, (path) => existing.has(path))

    expect(found).toBe('/repo/assets/validate/graphql')
  })
})
