import {scan} from '../index.js'
import {
  atomicWriteAppArtifact,
  atomicWriteFile,
  canonicalAppRoot,
  MAX_FINDINGS_FILE_SIZE_BYTES,
  MAX_REPOSITORY_FILE_SIZE_BYTES,
  safeReadFile,
  safeReadRepositoryFile,
} from '../repository-io.js'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {exec} from '@shopify/cli-kit/node/system'
import {afterEach, describe, expect, test} from 'vitest'
import {mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises'
import {mkdirSync, renameSync, symlinkSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'

const temporaryDirectories: string[] = []

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(joinPath(tmpdir(), 'app-doctor-boundary-'))
  temporaryDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})))
})

describe('App Doctor repository boundary', () => {
  test.skipIf(process.platform === 'win32')('rejects symlinks, oversized files, and non-regular files', async () => {
    const parent = await temporaryDirectory()
    const appRoot = joinPath(parent, 'app')
    const outside = joinPath(parent, 'outside')
    await mkdir(joinPath(appRoot, 'app', 'routes'), {recursive: true})
    await mkdir(joinPath(appRoot, 'vendor'), {recursive: true})
    await mkdir(joinPath(appRoot, 'extensions', 'evil'), {recursive: true})
    await mkdir(outside)
    await writeFile(joinPath(appRoot, 'shopify.app.toml'), 'name = "Boundary test"\n')
    await writeFile(joinPath(appRoot, 'app', 'routes', 'index.ts'), 'export const loader = () => ({ok: true})\n')

    const outsideSentinel = joinPath(outside, 'sentinel')
    const outsideSecret = ['shpat', '0123456789abcdef0123456789abcdef'].join('_')
    await writeFile(outsideSentinel, `${outsideSecret}\n`)
    await symlink(outsideSentinel, joinPath(appRoot, 'app', 'routes', 'linked.ts'))
    await symlink(outsideSentinel, joinPath(appRoot, 'shopify.app.evil.toml'))
    await symlink(outsideSentinel, joinPath(appRoot, 'vendor', 'package.json'))
    await symlink(outsideSentinel, joinPath(appRoot, 'Gemfile'))
    await symlink(outsideSentinel, joinPath(appRoot, 'composer.json'))
    await symlink(outsideSentinel, joinPath(appRoot, 'extensions', 'evil', 'shopify.extension.toml'))
    await symlink(outsideSentinel, joinPath(appRoot, '.env'))
    await symlink(outsideSentinel, joinPath(appRoot, 'secrets.json'))
    await writeFile(joinPath(appRoot, 'app', 'routes', 'large.ts'), 'x'.repeat(MAX_REPOSITORY_FILE_SIZE_BYTES + 1))
    await exec('mkfifo', [joinPath(appRoot, 'app', 'routes', 'pipe.ts')])

    const result = await scan(appRoot)
    const skipped = result.scan.files_skipped ?? []

    expect(skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({path: 'app/routes/linked.ts', reason: 'symlink'}),
        expect.objectContaining({path: 'shopify.app.evil.toml', reason: 'symlink'}),
        expect.objectContaining({path: 'extensions/evil/shopify.extension.toml', reason: 'symlink'}),
        expect.objectContaining({path: '.env', reason: 'symlink'}),
        expect.objectContaining({path: 'secrets.json', reason: 'symlink'}),
        expect.objectContaining({path: 'app/routes/large.ts', reason: 'too_large'}),
        expect.objectContaining({path: 'app/routes/pipe.ts', reason: 'not_regular'}),
      ]),
    )
    expect(result.scan.file_hashes).not.toHaveProperty('app/routes/linked.ts')
    expect(JSON.stringify(result)).not.toContain('0123456789abcdef0123456789abcdef')
  })

  test.skipIf(process.platform === 'win32')(
    'rejects paths outside the root and symlinked parent directories',
    async () => {
      const parent = await temporaryDirectory()
      const appRoot = joinPath(parent, 'app')
      const outside = joinPath(parent, 'outside')
      await mkdir(appRoot)
      await mkdir(outside)
      await writeFile(joinPath(outside, 'sentinel.ts'), 'outside')
      await symlink(outside, joinPath(appRoot, 'linked-directory'))
      const canonicalRoot = canonicalAppRoot(appRoot)

      expect(safeReadRepositoryFile(canonicalRoot, joinPath(outside, 'sentinel.ts'))).toMatchObject({
        ok: false,
        reason: 'outside_root',
      })
      expect(
        safeReadRepositoryFile(canonicalRoot, joinPath(canonicalRoot, 'linked-directory', 'sentinel.ts')),
      ).toMatchObject({
        ok: false,
        reason: 'symlink',
      })
    },
  )

  test.skipIf(process.platform === 'win32')(
    'rejects a repository parent exchanged after the file handle opens',
    async () => {
      const parent = await temporaryDirectory()
      const appRoot = joinPath(parent, 'app')
      const repositoryDirectory = joinPath(appRoot, 'config')
      const movedRepositoryDirectory = joinPath(appRoot, 'original-config')
      const outside = joinPath(parent, 'outside')
      await mkdir(repositoryDirectory, {recursive: true})
      await mkdir(outside)
      await writeFile(joinPath(repositoryDirectory, 'settings.json'), '{"inside":true}')
      await writeFile(joinPath(outside, 'settings.json'), '{"secret":"outside"}')

      const result = safeReadRepositoryFile(
        canonicalAppRoot(appRoot),
        joinPath(repositoryDirectory, 'settings.json'),
        MAX_REPOSITORY_FILE_SIZE_BYTES,
        {
          afterReadOpen: () => {
            renameSync(repositoryDirectory, movedRepositoryDirectory)
            symlinkSync(outside, repositoryDirectory, 'dir')
          },
        },
      )

      expect(result).toMatchObject({ok: false})
      if (!result.ok) expect(['symlink', 'outside_root']).toContain(result.reason)
      expect(JSON.stringify(result)).not.toContain('"secret"')
    },
  )

  test('rejects an atomic-write parent exchange without deleting a replacement temp', async () => {
    const parent = await temporaryDirectory()
    const outputDirectory = joinPath(parent, 'output')
    const movedOutputDirectory = joinPath(parent, 'moved-output')
    const output = joinPath(outputDirectory, 'instructions.md')
    let replacementTemporaryPath = ''
    await mkdir(outputDirectory)

    expect(() =>
      atomicWriteFile(output, 'replacement', {
        afterTemporaryFileClosed: (temporaryPath) => {
          renameSync(outputDirectory, movedOutputDirectory)
          mkdirSync(outputDirectory)
          replacementTemporaryPath = joinPath(outputDirectory, basename(temporaryPath))
          writeFileSync(replacementTemporaryPath, 'attacker-owned')
        },
      }),
    ).toThrow('destination directory changed')

    await expect(readFile(replacementTemporaryPath, 'utf8')).resolves.toBe('attacker-owned')
    await expect(readFile(output, 'utf8')).rejects.toThrow()
    expect((await readdir(movedOutputDirectory)).filter((path) => path.endsWith('.tmp'))).toHaveLength(1)
  })

  test.skipIf(process.platform === 'win32')('rejects a destination symlink introduced before rename', async () => {
    const directory = await temporaryDirectory()
    const sentinel = joinPath(directory, 'sentinel')
    const output = joinPath(directory, 'instructions.md')
    await writeFile(sentinel, 'unchanged')

    expect(() =>
      atomicWriteFile(output, 'replacement', {
        afterTemporaryFileClosed: () => symlinkSync(sentinel, output),
      }),
    ).toThrow('Refusing to replace symlink')
    await expect(readFile(sentinel, 'utf8')).resolves.toBe('unchanged')
    await expect(readdir(directory)).resolves.toEqual(expect.not.arrayContaining([expect.stringMatching(/\.tmp$/)]))
  })

  test('limits scanner artifacts to direct children of a canonical root', async () => {
    const appRoot = await temporaryDirectory()
    expect(() => atomicWriteAppArtifact(canonicalAppRoot(appRoot), '../trace.json', '{}')).toThrow(
      'Invalid App Doctor artifact filename',
    )
    await expect(readdir(appRoot)).resolves.toEqual([])
  })

  test.skipIf(process.platform === 'win32')('bounds findings and refuses to follow their symlinks', async () => {
    const directory = await temporaryDirectory()
    const oversized = joinPath(directory, 'oversized-findings.json')
    const sentinel = joinPath(directory, 'sentinel.json')
    const linked = joinPath(directory, 'linked-findings.json')
    await writeFile(oversized, 'x'.repeat(MAX_FINDINGS_FILE_SIZE_BYTES + 1))
    await writeFile(sentinel, '{"findings":[]}')
    await symlink(sentinel, linked)

    expect(safeReadFile(oversized, MAX_FINDINGS_FILE_SIZE_BYTES)).toMatchObject({
      ok: false,
      reason: 'too_large',
    })
    expect(safeReadFile(linked, MAX_FINDINGS_FILE_SIZE_BYTES)).toMatchObject({ok: false, reason: 'symlink'})
  })

  test.skipIf(process.platform === 'win32')(
    'does not follow an instructions output symlink or leave temp files',
    async () => {
      const directory = await temporaryDirectory()
      const sentinel = joinPath(directory, 'sentinel')
      const output = joinPath(directory, 'instructions.md')
      await writeFile(sentinel, 'unchanged')
      await symlink(sentinel, output)

      expect(() => atomicWriteFile(output, 'replacement')).toThrow('Refusing to replace symlink')
      await expect(readFile(sentinel, 'utf8')).resolves.toBe('unchanged')
      await expect(readdir(directory)).resolves.toEqual(expect.not.arrayContaining([expect.stringMatching(/\.tmp$/)]))
    },
  )
})
