import {
  createFixtureSymlink,
  inCanonicalTemporaryDirectory,
  makeFixtureDirectory,
  writeFixtureFile,
} from './context-test-helpers.js'
import {
  attempt,
  createStoreFile,
  ensureStoreDirectory,
  inspectStorePath,
  listStoreDirectory,
  readBounded,
  readStoreFile,
  removeStoreFile,
  renameStoreFile,
  storePathComponents,
} from '../store/files.js'
import {describe, expect, test} from 'vitest'
import {joinPath} from '@shopify/cli-kit/node/path'
import {chmod, lstat, open, readFile, writeFile} from 'node:fs/promises'
import {userInfo} from 'node:os'

const isWindows = process.platform === 'win32'
const isRoot = !isWindows && userInfo().uid === 0
const permissionBits = async (path: string) => (await lstat(path)).mode & 0o777
// Longer than one read chunk so bounded reads must concatenate several chunks.
const MULTI_CHUNK_SIZE = 64 * 1024 + 100

describe('attempt', () => {
  test('turns Node system errors into outcomes', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await expect(attempt(() => lstat(joinPath(root, 'missing')))).resolves.toEqual({ok: false, errno: 'ENOENT'})
      await expect(attempt(() => lstat(root))).resolves.toMatchObject({ok: true})
    })
  })

  test('propagates errors that are not system errors, including Node programmer errors', async () => {
    const plain = new Error('boom')
    await expect(
      attempt(() => {
        throw plain
      }),
    ).rejects.toBe(plain)
    // A real Node programmer error: it carries a `code` but no `errno` or `syscall`.
    await expect(attempt(() => lstat(123 as never))).rejects.toMatchObject({code: 'ERR_INVALID_ARG_TYPE'})
  })
})

describe('readBounded', () => {
  test('concatenates several chunks up to the limit and rejects one byte beyond it', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const content = Buffer.alloc(MULTI_CHUNK_SIZE, 'y')
      const file = joinPath(root, 'large.bin')
      await writeFile(file, content)

      const withinLimit = await open(file, 'r')
      try {
        await expect(readBounded(withinLimit, MULTI_CHUNK_SIZE)).resolves.toEqual(content)
      } finally {
        await withinLimit.close()
      }

      const beyondLimit = await open(file, 'r')
      try {
        await expect(readBounded(beyondLimit, MULTI_CHUNK_SIZE - 1)).resolves.toBeUndefined()
      } finally {
        await beyondLimit.close()
      }
    })
  })
})

describe('storePathComponents', () => {
  test('returns the components beneath the anchor', () => {
    expect(storePathComponents('/anchor', '/anchor/.shopify/app-doctor/x.json')).toEqual([
      '.shopify',
      'app-doctor',
      'x.json',
    ])
    expect(storePathComponents('/anchor', '/anchor')).toEqual([])
  })

  test('rejects escapes, relative paths, and foreign roots', () => {
    expect(storePathComponents('/anchor', '/anchor/../elsewhere')).toBeUndefined()
    expect(storePathComponents('/anchor', '/anchor/a/../../b')).toBeUndefined()
    expect(storePathComponents('/anchor', '/elsewhere/file')).toBeUndefined()
    expect(storePathComponents('/anchor', 'relative/file')).toBeUndefined()
    expect(storePathComponents('anchor', '/anchor/file')).toBeUndefined()
    expect(storePathComponents('/anchor', '/anchored/file')).toBeUndefined()
  })
})

describe('inspectStorePath', () => {
  test('classifies absent paths, files, and directories', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const file = await writeFixtureFile(root, 'store/a.json', '{}')
      await expect(inspectStorePath(root, joinPath(root, 'store/missing.json'))).resolves.toEqual({
        ok: true,
        value: {kind: 'absent'},
      })
      await expect(inspectStorePath(root, joinPath(root, 'nope/deeper/missing.json'))).resolves.toEqual({
        ok: true,
        value: {kind: 'absent'},
      })
      await expect(inspectStorePath(root, file)).resolves.toMatchObject({ok: true, value: {kind: 'file'}})
      await expect(inspectStorePath(root, joinPath(root, 'store'))).resolves.toMatchObject({
        ok: true,
        value: {kind: 'directory'},
      })
    })
  })

  test('rejects a symlink component and a symlink leaf as unsafe-path', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const real = await makeFixtureDirectory(root, 'real')
      await writeFixtureFile(real, 'a.json', '{}')
      await createFixtureSymlink(real, joinPath(root, 'linked'))
      await createFixtureSymlink(joinPath(real, 'a.json'), joinPath(real, 'link.json'))

      await expect(inspectStorePath(root, joinPath(root, 'linked/a.json'))).resolves.toMatchObject({
        ok: false,
        diagnostic: {code: 'unsafe-path', path: joinPath(root, 'linked')},
      })
      await expect(inspectStorePath(root, joinPath(real, 'link.json'))).resolves.toMatchObject({
        ok: false,
        diagnostic: {code: 'unsafe-path', path: joinPath(real, 'link.json')},
      })
    })
  })

  test('rejects a regular file where a directory component is expected', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await writeFixtureFile(root, 'store', 'not a directory')
      await expect(inspectStorePath(root, joinPath(root, 'store/a.json'))).resolves.toMatchObject({
        ok: false,
        diagnostic: {code: 'unsafe-path', path: joinPath(root, 'store')},
      })
    })
  })

  test('rejects paths outside the anchor', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await expect(inspectStorePath(root, joinPath(root, '..', 'x'))).resolves.toMatchObject({
        ok: false,
        diagnostic: {code: 'unsafe-path'},
      })
    })
  })
})

describe('ensureStoreDirectory', () => {
  test('creates every missing component and tolerates existing ones', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const target = joinPath(root, 'a/b/c')
      await expect(ensureStoreDirectory(root, target)).resolves.toEqual({ok: true, value: undefined})
      await expect(ensureStoreDirectory(root, target)).resolves.toEqual({ok: true, value: undefined})
      await expect(inspectStorePath(root, target)).resolves.toMatchObject({ok: true, value: {kind: 'directory'}})
    })
  })

  test.skipIf(isWindows)('creates directories with 0700', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const target = joinPath(root, 'a/b')
      await ensureStoreDirectory(root, target)
      await expect(permissionBits(joinPath(root, 'a'))).resolves.toBe(0o700)
      await expect(permissionBits(target)).resolves.toBe(0o700)
    })
  })

  test('refuses to traverse a symlinked component', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const real = await makeFixtureDirectory(root, 'real')
      await createFixtureSymlink(real, joinPath(root, 'linked'))
      await expect(ensureStoreDirectory(root, joinPath(root, 'linked/child'))).resolves.toMatchObject({
        ok: false,
        diagnostic: {code: 'unsafe-path', path: joinPath(root, 'linked')},
      })
      await expect(inspectStorePath(root, joinPath(real, 'child'))).resolves.toEqual({
        ok: true,
        value: {kind: 'absent'},
      })
    })
  })
})

describe('readStoreFile', () => {
  test('reads a regular file within the limit', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const file = await writeFixtureFile(root, 'store/a.json', '{"a":1}\n')
      const read = await readStoreFile(root, file, 100)
      expect(read).toMatchObject({status: 'present'})
      if (read.status !== 'present') throw new Error('expected present')
      expect(read.bytes.toString('utf8')).toBe('{"a":1}\n')
      expect(read.stats.size).toBe(8)
    })
  })

  test('reports absent files distinctly from errors', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      await expect(readStoreFile(root, joinPath(root, 'store/a.json'), 100)).resolves.toEqual({status: 'absent'})
    })
  })

  test('accepts a file at the limit and rejects one byte beyond it', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const atLimit = await writeFixtureFile(root, 'at.bin', 'x'.repeat(64))
      const beyond = await writeFixtureFile(root, 'beyond.bin', 'x'.repeat(65))
      await expect(readStoreFile(root, atLimit, 64)).resolves.toMatchObject({status: 'present'})
      await expect(readStoreFile(root, beyond, 64)).resolves.toMatchObject({
        status: 'error',
        diagnostic: {code: 'oversized', path: beyond},
      })
    })
  })

  test('reads a file larger than one chunk when the limit allows it and rejects it one byte below', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const content = Buffer.alloc(MULTI_CHUNK_SIZE, 'z')
      const file = joinPath(root, 'large.bin')
      await writeFile(file, content)

      const read = await readStoreFile(root, file, MULTI_CHUNK_SIZE)
      if (read.status !== 'present') throw new Error(`expected present, got ${read.status}`)
      expect(read.bytes.equals(content)).toBe(true)
      expect(read.stats.size).toBe(MULTI_CHUNK_SIZE)

      await expect(readStoreFile(root, file, MULTI_CHUNK_SIZE - 1)).resolves.toMatchObject({
        status: 'error',
        diagnostic: {code: 'oversized', path: file},
      })
    })
  })

  test('rejects a symlink leaf even when its target is a regular file', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const target = await writeFixtureFile(root, 'real/a.json', '{}')
      const link = joinPath(root, 'real/link.json')
      await createFixtureSymlink(target, link)
      await expect(readStoreFile(root, link, 100)).resolves.toMatchObject({
        status: 'error',
        diagnostic: {code: 'unsafe-path', path: link},
      })
    })
  })

  test('rejects a directory', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const directory = await makeFixtureDirectory(root, 'dir.json')
      await expect(readStoreFile(root, directory, 100)).resolves.toMatchObject({
        status: 'error',
        diagnostic: {code: 'unsafe-path'},
      })
    })
  })

  test.skipIf(isWindows || isRoot)('reports EACCES as inaccessible', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const file = await writeFixtureFile(root, 'secret.json', '{}')
      await chmod(file, 0o000)
      try {
        await expect(readStoreFile(root, file, 100)).resolves.toMatchObject({
          status: 'error',
          diagnostic: {code: 'inaccessible', path: file, errno: 'EACCES'},
        })
      } finally {
        await chmod(file, 0o600)
      }
    })
  })
})

describe('createStoreFile', () => {
  test('writes bytes exclusively and refuses to overwrite', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const path = joinPath(root, 'store/new.json')
      await ensureStoreDirectory(root, joinPath(root, 'store'))
      await expect(createStoreFile(root, path, Buffer.from('one'))).resolves.toEqual({ok: true, value: undefined})
      await expect(readFile(path, 'utf8')).resolves.toBe('one')
      await expect(createStoreFile(root, path, Buffer.from('two'))).resolves.toMatchObject({
        ok: false,
        diagnostic: {code: 'io', errno: 'EEXIST', path},
      })
      await expect(readFile(path, 'utf8')).resolves.toBe('one')
    })
  })

  test.skipIf(isWindows)('creates files with 0600', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const path = joinPath(root, 'new.json')
      await createStoreFile(root, path, Buffer.from('one'))
      await expect(permissionBits(path)).resolves.toBe(0o600)
    })
  })

  test('refuses a parent that is a symlink', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const real = await makeFixtureDirectory(root, 'real')
      await createFixtureSymlink(real, joinPath(root, 'linked'))
      await expect(createStoreFile(root, joinPath(root, 'linked/new.json'), Buffer.from('x'))).resolves.toMatchObject({
        ok: false,
        diagnostic: {code: 'unsafe-path'},
      })
      await expect(inspectStorePath(root, joinPath(real, 'new.json'))).resolves.toEqual({
        ok: true,
        value: {kind: 'absent'},
      })
    })
  })
})

describe('renameStoreFile and removeStoreFile', () => {
  test('renames over an existing file and removes files idempotently', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const from = await writeFixtureFile(root, 'store/.a.json.next', 'new')
      const to = await writeFixtureFile(root, 'store/a.json', 'old')
      await expect(renameStoreFile(root, from, to)).resolves.toEqual({ok: true, value: undefined})
      await expect(readFile(to, 'utf8')).resolves.toBe('new')
      await expect(inspectStorePath(root, from)).resolves.toEqual({ok: true, value: {kind: 'absent'}})

      await expect(removeStoreFile(root, to)).resolves.toEqual({ok: true, value: undefined})
      await expect(removeStoreFile(root, to)).resolves.toEqual({ok: true, value: undefined})
      await expect(inspectStorePath(root, to)).resolves.toEqual({ok: true, value: {kind: 'absent'}})
    })
  })

  test('refuses to rename a symlink source', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const target = await writeFixtureFile(root, 'store/real.json', 'real')
      const link = joinPath(root, 'store/link.json')
      await createFixtureSymlink(target, link)
      await expect(renameStoreFile(root, link, joinPath(root, 'store/a.json'))).resolves.toMatchObject({
        ok: false,
        diagnostic: {code: 'unsafe-path', path: link},
      })
    })
  })

  test('refuses to remove a symlink, a directory, or a path outside the anchor', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const target = await writeFixtureFile(root, 'store/real.json', 'real')
      const link = joinPath(root, 'store/link.json')
      await createFixtureSymlink(target, link)
      await expect(removeStoreFile(root, link)).resolves.toMatchObject({
        ok: false,
        diagnostic: {code: 'unsafe-path', path: link},
      })
      await expect(lstat(link)).resolves.toMatchObject({})
      await expect(removeStoreFile(root, joinPath(root, 'store'))).resolves.toMatchObject({
        ok: false,
        diagnostic: {code: 'unsafe-path'},
      })
      await expect(removeStoreFile(root, joinPath(root, '..', 'elsewhere'))).resolves.toMatchObject({
        ok: false,
        diagnostic: {code: 'unsafe-path'},
      })
      await expect(readFile(target, 'utf8')).resolves.toBe('real')
    })
  })
})

describe('listStoreDirectory', () => {
  test('lists entries with their kinds and reports absence', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const directory = await makeFixtureDirectory(root, 'results')
      await writeFile(joinPath(directory, 'b.json'), '{}')
      await writeFile(joinPath(directory, 'a.json'), '{}')
      await makeFixtureDirectory(directory, 'sub')
      await createFixtureSymlink(joinPath(directory, 'a.json'), joinPath(directory, 'link.json'))

      await expect(listStoreDirectory(root, directory)).resolves.toEqual({
        status: 'present',
        entries: [
          {name: 'a.json', kind: 'file'},
          {name: 'b.json', kind: 'file'},
          {name: 'link.json', kind: 'other'},
          {name: 'sub', kind: 'directory'},
        ],
      })
      await expect(listStoreDirectory(root, joinPath(root, 'missing'))).resolves.toEqual({status: 'absent'})
    })
  })

  test('reports a regular file in place of the directory as unsafe-path', async () => {
    await inCanonicalTemporaryDirectory(async (root) => {
      const file = await writeFixtureFile(root, 'results', 'not a directory')
      await expect(listStoreDirectory(root, file)).resolves.toMatchObject({
        status: 'error',
        diagnostic: {code: 'unsafe-path', path: file},
      })
    })
  })
})
