import {scanDependencyAutomation} from '../rules/dependency-automation-rules.js'
import {describe, expect, test} from 'vitest'
import type {ManifestFile, ScanContext} from '../rules/types.js'

const manifest = (path = 'package.json'): ManifestFile => ({
  path,
  absolutePath: `/${path}`,
  type: 'npm',
  dependencies: {react: '19.0.0'},
})

function scan(dependencyAutomation: ScanContext['dependencyAutomation'] = {files: []}, manifests = [manifest()]) {
  return scanDependencyAutomation({manifests, dependencyAutomation})
}

describe('dependency-management configuration file presence', () => {
  test('is not applicable without declared dependencies', () => {
    expect(scan({files: []}, [])).toEqual({issues: []})
    expect(scan({files: []}, [{...manifest(), dependencies: {}}])).toEqual({issues: []})
  })

  test('includes development dependencies and anchors one finding to a real manifest', () => {
    const result = scan({files: []}, [manifest('packages/web/package.json'), manifest()])
    expect(
      scan({files: []}, [{...manifest(), dependencies: {}, devDependencies: {vitest: '4.0.0'}}]).issues,
    ).toHaveLength(1)
    expect(result.issues).toEqual([
      expect.objectContaining({
        id: 'MISSING_DEPENDENCY_SECURITY_AUTOMATION',
        severity: 'low',
        points: -5,
        title: 'Dependency management configuration file not detected',
        location: {file: 'package.json'},
        fix: expect.objectContaining({automated: false}),
      }),
    ])
    expect(result.issues[0]?.message).toContain('does not validate their contents')
  })

  test('preserves discovery obstacles without a finding', () => {
    expect(scan({files: [], unresolvedReason: 'Nested repository'})).toEqual({
      issues: [],
      unresolvedReason: 'Nested repository',
    })
  })

  test.each(['', '{malformed', '{"enabled":false}', '{"extends":["local>org/config"]}'])(
    'treats presence as sufficient, regardless of configuration content: %s',
    (content) => {
      expect(scan({files: [{path: 'renovate.json', absolutePath: '/renovate.json', ext: '.json', content}]})).toEqual({
        issues: [],
      })
    },
  )
})
