import {
  appDoctorScopeIdentity,
  canonicalLocation,
  containsPath,
  projectAppDoctorEvidencePath,
  projectAppDoctorPath,
  resolveAppDoctorEvidencePath,
  resolveAppDoctorScopeDirectory,
} from '../scopes/paths.js'
import {AppDoctorScopeError} from '../scopes/types.js'
import {describe, expect, test} from 'vitest'
import {createHash} from 'node:crypto'

/** Recompute a digest without the engine so tests pin the preimage encoding. */
const independentDigest = (preimage: unknown[]) =>
  `sha256:${createHash('sha256').update(JSON.stringify(preimage), 'utf8').digest('hex')}`

describe('canonicalLocation', () => {
  test('leaves POSIX paths unchanged apart from trailing separators', () => {
    expect(canonicalLocation('/repo/app/', 'posix')).toBe('/repo/app')
    expect(canonicalLocation('/repo/app', 'posix')).toBe('/repo/app')
    expect(canonicalLocation('/', 'posix')).toBe('/')
  })

  test('uppercases a Windows drive root and normalizes separators', () => {
    expect(canonicalLocation('c:/repo/app/', 'win32')).toBe('C:\\repo\\app')
    expect(canonicalLocation('c:\\', 'win32')).toBe('C:\\')
  })

  test('lowercases a UNC root but keeps descendant spelling', () => {
    expect(canonicalLocation('\\\\SERVER\\Share\\Repo\\App', 'win32')).toBe('\\\\server\\share\\Repo\\App')
    expect(canonicalLocation('\\\\SERVER\\Share\\', 'win32')).toBe('\\\\server\\share\\')
  })

  test('strips Windows namespace prefixes before extracting the root', () => {
    expect(canonicalLocation('\\\\?\\c:\\Users\\dev\\repo', 'win32')).toBe('C:\\Users\\dev\\repo')
    expect(canonicalLocation('\\\\?\\UNC\\Server\\share\\repo', 'win32')).toBe('\\\\server\\share\\repo')
  })

  test('rejects relative paths', () => {
    expect(() => canonicalLocation('repo/app', 'posix')).toThrow(AppDoctorScopeError)
    expect(() => canonicalLocation('repo\\app', 'win32')).toThrow(
      expect.objectContaining({code: 'INVALID_PATH'}) as unknown as Error,
    )
  })
})

describe('containsPath', () => {
  test('is true for the directory itself and for descendants', () => {
    expect(containsPath('/repo', '/repo', 'posix')).toBe(true)
    expect(containsPath('/repo', '/repo/app/web', 'posix')).toBe(true)
  })

  test('compares components, not string prefixes', () => {
    expect(containsPath('/repo/app', '/repo/app2', 'posix')).toBe(false)
    expect(containsPath('/repo', '/repo/..x', 'posix')).toBe(true)
    expect(containsPath('/repo/app', '/repo', 'posix')).toBe(false)
    expect(containsPath('/repo/app', '/other/app', 'posix')).toBe(false)
  })

  test('never crosses Windows volumes', () => {
    expect(containsPath('C:\\repo', 'D:\\repo\\app', 'win32')).toBe(false)
    expect(containsPath('C:\\repo', 'c:\\repo\\app', 'win32')).toBe(true)
  })
})

describe('projectAppDoctorPath', () => {
  test('projects an in-anchor directory with no upward steps', () => {
    expect(projectAppDoctorPath('/repo', '/repo/packages/app', 'posix')).toEqual({
      base: 'storage_anchor',
      up: 0,
      path: 'packages/app',
    })
  })

  test('projects the anchor itself as the base', () => {
    expect(projectAppDoctorPath('/repo', '/repo', 'posix')).toEqual({base: 'storage_anchor', up: 0, path: '.'})
  })

  test('counts leading parent steps for a target outside the anchor', () => {
    expect(projectAppDoctorPath('/home/dev/repo', '/foo/lib', 'posix')).toEqual({
      base: 'storage_anchor',
      up: 3,
      path: 'foo/lib',
    })
    expect(projectAppDoctorPath('/repo/app', '/repo', 'posix')).toEqual({base: 'storage_anchor', up: 1, path: '.'})
  })

  test('percent-encodes each component', () => {
    expect(projectAppDoctorPath('/repo', '/repo/[shop]/100%/my app/ünïcode', 'posix')).toEqual({
      base: 'storage_anchor',
      up: 0,
      path: '%5Bshop%5D/100%25/my%20app/%C3%BCn%C3%AFcode',
    })
    expect(projectAppDoctorPath('/repo', '/repo/a#b/c?d', 'posix')).toEqual({
      base: 'storage_anchor',
      up: 0,
      path: 'a%23b/c%3Fd',
    })
  })

  test('projects a different Windows drive as an external volume', () => {
    expect(projectAppDoctorPath('C:\\repo', 'd:\\data\\lib', 'win32')).toEqual({
      base: 'external_volume',
      volume_token: independentDigest(['shopify-app-doctor/volume/v1', 'D:\\']),
      path: 'data/lib',
    })
    expect(projectAppDoctorPath('C:\\repo', 'D:\\', 'win32')).toEqual({
      base: 'external_volume',
      volume_token: independentDigest(['shopify-app-doctor/volume/v1', 'D:\\']),
      path: '.',
    })
  })

  test('projects a UNC share as an external volume keyed by its lowercase root', () => {
    expect(projectAppDoctorPath('C:\\repo', '\\\\Server\\Share\\Lib', 'win32')).toEqual({
      base: 'external_volume',
      volume_token: independentDigest(['shopify-app-doctor/volume/v1', '\\\\server\\share\\']),
      path: 'Lib',
    })
  })

  test('stays anchor-relative on the same Windows drive regardless of drive casing', () => {
    expect(projectAppDoctorPath('c:\\repo', 'C:\\repo\\app', 'win32')).toEqual({
      base: 'storage_anchor',
      up: 0,
      path: 'app',
    })
  })
})

describe('appDoctorScopeIdentity', () => {
  test('hashes the anchor-relative locator for in-anchor directories', () => {
    expect(appDoctorScopeIdentity('/repo', '/repo/packages/app', 'posix')).toBe(
      independentDigest(['shopify-app-doctor/scope/v1', ['anchor_relative', 'packages/app']]),
    )
    expect(appDoctorScopeIdentity('/repo', '/repo', 'posix')).toBe(
      independentDigest(['shopify-app-doctor/scope/v1', ['anchor_relative', '.']]),
    )
  })

  test('is stable when the whole anchor relocates', () => {
    expect(appDoctorScopeIdentity('/home/a/repo', '/home/a/repo/app', 'posix')).toBe(
      appDoctorScopeIdentity('/mnt/b/checkout', '/mnt/b/checkout/app', 'posix'),
    )
    expect(appDoctorScopeIdentity('C:\\repo', 'C:\\repo\\app', 'win32')).toBe(
      appDoctorScopeIdentity('/repo', '/repo/app', 'posix'),
    )
  })

  test('hashes the canonical absolute locator for directories outside the anchor', () => {
    expect(appDoctorScopeIdentity('/repo', '/shared/lib', 'posix')).toBe(
      independentDigest(['shopify-app-doctor/scope/v1', ['canonical_absolute', 'posix', '/shared/lib']]),
    )
    expect(appDoctorScopeIdentity('C:\\repo', 'd:\\shared\\lib', 'win32')).toBe(
      independentDigest(['shopify-app-doctor/scope/v1', ['canonical_absolute', 'win32', 'D:\\shared\\lib']]),
    )
  })

  test('differs for distinct directories', () => {
    expect(appDoctorScopeIdentity('/repo', '/repo/app', 'posix')).not.toBe(
      appDoctorScopeIdentity('/repo', '/repo/app/web', 'posix'),
    )
  })

  test('distinguishes directories that differ only by a lone surrogate', () => {
    // The store leaf is derived from this digest, so a JSON-escaped preimage must keep them apart.
    expect(appDoctorScopeIdentity('/repo', '/repo/\ud800', 'posix')).not.toBe(
      appDoctorScopeIdentity('/repo', '/repo/\ud801', 'posix'),
    )
  })
})

describe('projectAppDoctorEvidencePath', () => {
  test('formats an in-anchor file', () => {
    expect(projectAppDoctorEvidencePath('/repo', '/repo/app/routes/webhooks.tsx', 'posix')).toBe(
      'anchor/0/app/routes/webhooks.tsx',
    )
  })

  test('formats a file outside the anchor with its upward step count', () => {
    expect(projectAppDoctorEvidencePath('/home/dev/repo', '/home/shared/lib/index.ts', 'posix')).toBe(
      'anchor/2/shared/lib/index.ts',
    )
  })

  test('formats a file on another Windows volume', () => {
    const token = independentDigest(['shopify-app-doctor/volume/v1', 'D:\\']).slice('sha256:'.length)
    expect(projectAppDoctorEvidencePath('C:\\repo', 'D:\\lib\\index.ts', 'win32')).toBe(`volume/${token}/lib/index.ts`)
  })

  test('reports a component the evidence contract rejects as a scope error', () => {
    expect(() => projectAppDoctorEvidencePath('/repo', '/repo/a\nb/index.ts', 'posix')).toThrow(AppDoctorScopeError)
    expect(() => projectAppDoctorEvidencePath('/repo', '/repo/a\nb/index.ts', 'posix')).toThrow(
      expect.objectContaining({code: 'DESCRIPTOR_INVALID'}) as unknown as Error,
    )
  })
})

describe('resolveAppDoctorEvidencePath', () => {
  test('round-trips nested in-anchor files with spaces, percent signs, and unicode', () => {
    const anchor = '/home/dev/repo'
    for (const file of [
      '/home/dev/repo/app/routes/webhooks.tsx',
      '/home/dev/repo/app/my dir/100% done/ünïcode ✓.ts',
      '/home/dev/repo/app/back\\slash/index.ts',
    ]) {
      const reference = projectAppDoctorEvidencePath(anchor, file, 'posix')
      expect(resolveAppDoctorEvidencePath(reference, anchor, 'posix')).toBe(file)
    }
  })

  test('round-trips files above the anchor by stepping up the recorded number of levels', () => {
    const reference = projectAppDoctorEvidencePath('/home/dev/repo', '/home/shared/lib/index.ts', 'posix')
    expect(reference).toBe('anchor/2/shared/lib/index.ts')
    expect(resolveAppDoctorEvidencePath(reference, '/home/dev/repo', 'posix')).toBe('/home/shared/lib/index.ts')
  })

  test('round-trips Windows paths under the same volume', () => {
    const reference = projectAppDoctorEvidencePath('C:\\repo', 'C:\\repo\\app\\my dir\\index.ts', 'win32')
    expect(resolveAppDoctorEvidencePath(reference, 'C:\\repo', 'win32')).toBe('C:\\repo\\app\\my dir\\index.ts')
  })

  test('joins under whatever anchor is supplied, so a relocated checkout resolves to its new location', () => {
    expect(resolveAppDoctorEvidencePath('anchor/0/app/index.ts', '/elsewhere/checkout', 'posix')).toBe(
      '/elsewhere/checkout/app/index.ts',
    )
  })

  test('has no local spelling for a file on another Windows volume', () => {
    const reference = projectAppDoctorEvidencePath('C:\\repo', 'D:\\lib\\index.ts', 'win32')
    expect(reference.startsWith('volume/')).toBe(true)
    expect(resolveAppDoctorEvidencePath(reference, 'C:\\repo', 'win32')).toBeUndefined()
  })

  test('returns undefined for malformed references instead of throwing', () => {
    for (const reference of [
      '',
      'index.ts',
      'anchor',
      'anchor/0',
      'anchor/0/.',
      'anchor/0/..',
      'anchor/0//index.ts',
      'anchor/x/index.ts',
      'anchor/01/index.ts',
      'anchor/0/%ZZ',
      'anchor/0/a%2Fb',
      'anchor/0/app\\index.ts',
      'volume/nothex/index.ts',
      'other/0/index.ts',
    ]) {
      expect(resolveAppDoctorEvidencePath(reference, '/repo', 'posix'), reference).toBeUndefined()
    }
  })

  test('returns undefined when the reference steps above the anchor root or the anchor is not absolute', () => {
    expect(resolveAppDoctorEvidencePath('anchor/3/index.ts', '/home/repo', 'posix')).toBeUndefined()
    expect(resolveAppDoctorEvidencePath('anchor/2/index.ts', '/home/repo', 'posix')).toBe('/index.ts')
    expect(resolveAppDoctorEvidencePath('anchor/0/index.ts', 'relative/repo', 'posix')).toBeUndefined()
  })

  test('returns undefined for a Windows component that decodes to a separator', () => {
    expect(resolveAppDoctorEvidencePath('anchor/0/app%5Cindex.ts', 'C:\\repo', 'win32')).toBeUndefined()
  })
})

describe('resolveAppDoctorScopeDirectory', () => {
  test('round-trips in-anchor directories, including the anchor itself', () => {
    const anchor = '/home/dev/repo'
    for (const directory of ['/home/dev/repo', '/home/dev/repo/app', '/home/dev/repo/app/my dir/ünïcode ✓']) {
      const reference = projectAppDoctorPath(anchor, directory, 'posix')
      expect(resolveAppDoctorScopeDirectory(reference, anchor, 'posix'), directory).toBe(directory)
    }
  })

  test('round-trips directories above the anchor by stepping up the recorded number of levels', () => {
    const reference = projectAppDoctorPath('/home/dev/repo', '/home/shared', 'posix')
    expect(reference).toEqual({base: 'storage_anchor', up: 2, path: 'shared'})
    expect(resolveAppDoctorScopeDirectory(reference, '/home/dev/repo', 'posix')).toBe('/home/shared')
  })

  test('joins under whatever anchor is supplied, so a relocated checkout resolves to its new location', () => {
    expect(
      resolveAppDoctorScopeDirectory({base: 'storage_anchor', up: 0, path: 'app/web'}, '/elsewhere/checkout', 'posix'),
    ).toBe('/elsewhere/checkout/app/web')
  })

  test('round-trips Windows directories under the same volume', () => {
    const reference = projectAppDoctorPath('C:\\repo', 'C:\\repo\\app\\my dir', 'win32')
    expect(resolveAppDoctorScopeDirectory(reference, 'C:\\repo', 'win32')).toBe('C:\\repo\\app\\my dir')
  })

  test('has no local spelling for a directory on another Windows volume', () => {
    const reference = projectAppDoctorPath('C:\\repo', 'D:\\lib', 'win32')
    expect(reference.base).toBe('external_volume')
    expect(resolveAppDoctorScopeDirectory(reference, 'C:\\repo', 'win32')).toBeUndefined()
  })

  test('returns undefined when the reference steps above the anchor root or the anchor is not absolute', () => {
    expect(
      resolveAppDoctorScopeDirectory({base: 'storage_anchor', up: 3, path: '.'}, '/home/repo', 'posix'),
    ).toBeUndefined()
    expect(resolveAppDoctorScopeDirectory({base: 'storage_anchor', up: 2, path: '.'}, '/home/repo', 'posix')).toBe('/')
    expect(
      resolveAppDoctorScopeDirectory({base: 'storage_anchor', up: 0, path: 'app'}, 'relative/repo', 'posix'),
    ).toBeUndefined()
  })

  test('returns undefined for a Windows component that decodes to a separator', () => {
    expect(
      resolveAppDoctorScopeDirectory({base: 'storage_anchor', up: 0, path: 'app%5Cweb'}, 'C:\\repo', 'win32'),
    ).toBeUndefined()
  })
})
