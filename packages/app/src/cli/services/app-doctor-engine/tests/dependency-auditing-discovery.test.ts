/* eslint-disable no-restricted-imports -- discovery boundaries use real temporary repositories */
import {findDependencyAuditingInputs, findManifests, getSkippedFiles, resetSkippedFiles} from '../scanners/discover.js'
import {afterEach, describe, expect, test} from 'vitest'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdir, mkdtemp, rm, symlink, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {dirname, join} from 'node:path'

const temporaryDirectories: string[] = []

afterEach(async () => {
  resetSkippedFiles()
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {recursive: true, force: true})))
})

async function makeDirectory(prefix = 'app-doctor-dependency-discovery-'): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const fullPath = join(root, path)
      await mkdir(dirname(fullPath), {recursive: true})
      await writeFile(fullPath, content)
    }),
  )
}

describe('dependency auditing input discovery', () => {
  test('treats an empty allowlist as complete discovery', async () => {
    const root = await makeDirectory()

    expect(findDependencyAuditingInputs(root)).toEqual({files: []})
  })

  test('reads only explicitly allowlisted hidden CI configuration with exact raw content', async () => {
    const root = await makeDirectory()
    const workflow = 'name: dependency review\r\npermissions: {}\r\n'
    await writeFiles(root, {
      '.github/workflows/dependencies.yml': workflow,
      '.github/workflows/release.yaml': 'name: release\n',
      '.github/workflows/ignored.json': '{}',
      '.gitlab-ci.yml': 'audit:\n  script: npm audit\n',
      '.circleci/config.yml': 'version: 2.1\n',
      '.circleci/other.yml': 'not: allowlisted\n',
      '.hidden/config.yml': 'not: allowlisted\n',
    })

    const result = findDependencyAuditingInputs(root)

    expect(result.unresolvedReason).toBeUndefined()
    expect(result.files.map(({path}) => path)).toEqual([
      '.circleci/config.yml',
      '.github/workflows/dependencies.yml',
      '.github/workflows/release.yaml',
      '.gitlab-ci.yml',
    ])
    const discoveredWorkflow = result.files.find(({path}) => path.endsWith('dependencies.yml'))
    expect(discoveredWorkflow?.content).toBe(workflow)
    expect(
      createHash('sha256')
        .update(discoveredWorkflow?.content ?? '')
        .digest('hex'),
    ).toBe(createHash('sha256').update(workflow).digest('hex'))
  })

  test('preserves bounded reads and skipped-file coverage', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {'.github/workflows/ci.yml': 'x'.repeat(500_001)})
    resetSkippedFiles()

    const result = findDependencyAuditingInputs(root)

    expect(result).toMatchObject({files: [{path: '.github/workflows/ci.yml', content: undefined}]})
    expect(result.unresolvedReason).toBeUndefined()
    expect(getSkippedFiles()).toEqual([
      expect.objectContaining({path: '.github/workflows/ci.yml', reason: 'too_large', size_bytes: 500_001}),
    ])
  })

  test.each(['directory', 'worktree file'])(
    'does not inspect app config nested below a repository %s marker',
    async (marker) => {
      const repository = await makeDirectory()
      const app = join(repository, 'apps', 'example')
      await writeFiles(app, {'.github/workflows/audit.yml': 'name: audit\n'})
      if (marker === 'directory') await mkdir(join(repository, '.git'))
      else await writeFile(join(repository, '.git'), 'gitdir: /outside/not-read\n')

      const result = findDependencyAuditingInputs(app)

      expect(result.files).toEqual([])
      expect(result.unresolvedReason).toContain('nested below repository root')
    },
  )

  test.each(['directory', 'worktree file'])(
    'uses an app-root repository %s marker without inspecting a parent repository marker',
    async (marker) => {
      const repository = await makeDirectory()
      const app = join(repository, 'apps', 'example')
      await writeFiles(app, {'.github/workflows/ci.yml': 'name: audit\n'})
      await mkdir(join(repository, '.git'))
      if (marker === 'directory') await mkdir(join(app, '.git'))
      else await writeFile(join(app, '.git'), 'gitdir: /outside/not-read\n')

      const result = findDependencyAuditingInputs(app)

      expect(result.files).toMatchObject([{path: '.github/workflows/ci.yml', content: 'name: audit\n'}])
      expect(result.unresolvedReason).toBeUndefined()
    },
  )

  test('rejects an app-root repository marker symlink as ambiguous', async () => {
    const root = await makeDirectory()
    await mkdir(join(root, 'repository-metadata'))
    await symlink(join(root, 'repository-metadata'), join(root, '.git'), 'dir')

    const result = findDependencyAuditingInputs(root)

    expect(result.files).toEqual([])
    expect(result.unresolvedReason).toContain('Could not determine repository ownership')
  })

  test.skipIf(process.platform === 'win32')('rejects an app-root special repository marker as ambiguous', async () => {
    const root = await makeDirectory()
    execFileSync('mkfifo', [join(root, '.git')])

    const result = findDependencyAuditingInputs(root)

    expect(result.files).toEqual([])
    expect(result.unresolvedReason).toContain('Could not determine repository ownership')
  })

  test('rejects an allowlisted file symlink that escapes the app root', async () => {
    const root = await makeDirectory()
    const outside = await makeDirectory('app-doctor-dependency-outside-')
    await writeFile(join(outside, 'pipeline.yml'), 'audit: true\n')
    await mkdir(join(root, '.github', 'workflows'), {recursive: true})
    await symlink(join(outside, 'pipeline.yml'), join(root, '.github', 'workflows', 'ci.yml'))

    const result = findDependencyAuditingInputs(root)

    expect(result.files).toEqual([])
    expect(result.unresolvedReason).toContain('outside the app root')
  })

  test.each(['.github', '.github/workflows'])(
    'reports an escaping %s directory symlink instead of treating workflows as absent',
    async (linkedDirectory) => {
      const root = await makeDirectory()
      const outside = await makeDirectory('app-doctor-workflows-outside-')
      await writeFiles(outside, {'workflows/audit.yml': 'name: audit\n', 'audit.yml': 'name: audit\n'})
      await mkdir(dirname(join(root, linkedDirectory)), {recursive: true})
      await symlink(outside, join(root, linkedDirectory), 'dir')

      const result = findDependencyAuditingInputs(root)

      expect(result.files).toEqual([])
      expect(result.unresolvedReason).toContain('outside the app root')
    },
  )

  test('reports dangling allowlisted directory symlinks', async () => {
    const root = await makeDirectory()
    await mkdir(join(root, '.github'))
    await symlink(join(root, 'missing-workflows'), join(root, '.github', 'workflows'), 'dir')

    const result = findDependencyAuditingInputs(root)

    expect(result.files).toEqual([])
    expect(result.unresolvedReason).toContain('dangling symbolic link')
  })
})

describe('manifest safety and validation', () => {
  test('rejects explicit parent paths and manifest symlinks outside the app root', async () => {
    const root = await makeDirectory()
    const outside = await makeDirectory('app-doctor-manifest-outside-')
    await writeFile(join(outside, 'package.json'), JSON.stringify({dependencies: {unsafe: '1.0.0'}}))
    await symlink(join(outside, 'package.json'), join(root, 'package.json'))
    resetSkippedFiles()

    expect(findManifests(root, ['package.json', '../package.json'])).toEqual([])
    expect(getSkippedFiles()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'package.json',
          reason: 'unreadable',
          detail: 'symbolic link escapes the app root',
        }),
        expect.objectContaining({path: '../package.json', reason: 'unreadable', detail: 'path escapes the app root'}),
      ]),
    )
  })

  test.skipIf(process.platform === 'win32')('rejects a manifest FIFO before attempting to read it', async () => {
    const root = await makeDirectory()
    execFileSync('mkfifo', [join(root, 'package.json')])
    resetSkippedFiles()

    expect(findManifests(root, ['package.json'])).toEqual([])
    expect(getSkippedFiles()).toEqual([
      expect.objectContaining({path: 'package.json', reason: 'unreadable', detail: 'path is not a regular file'}),
    ])
  })

  test('keeps manifests without dependencies as valid inputs', async () => {
    const root = await makeDirectory()
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({name: 'dependency-free-app', scripts: {start: 'shopify app dev'}}),
    )

    expect(findManifests(root)).toMatchObject([
      {
        dependencies: {},
        devDependencies: {},
        scripts: {start: 'shopify app dev'},
      },
    ])
    expect(getSkippedFiles()).toEqual([])
  })

  test('stores string-valued scripts and dependency records', async () => {
    const root = await makeDirectory()
    await writeFiles(root, {
      'package.json': JSON.stringify({
        dependencies: {production: '^1.0.0'},
        devDependencies: {development: '^2.0.0'},
        scripts: {audit: 'npm audit'},
      }),
    })

    expect(findManifests(root)).toMatchObject([
      {
        dependencies: {production: '^1.0.0'},
        devDependencies: {development: '^2.0.0'},
        scripts: {audit: 'npm audit'},
      },
    ])
  })

  test.each([
    ['null package', 'null'],
    ['array package', '[]'],
    ['non-string dependency', JSON.stringify({dependencies: {unsafe: 1}})],
    ['non-string development dependency', JSON.stringify({devDependencies: {unsafe: null}})],
    ['non-string script', JSON.stringify({scripts: {audit: ['npm audit']}})],
  ])('keeps a malformed %s as skipped input coverage', async (_description, content) => {
    const root = await makeDirectory()
    await writeFile(join(root, 'package.json'), content)
    resetSkippedFiles()

    const manifests = findManifests(root)

    expect(manifests).toMatchObject([{dependencies: {}, devDependencies: {}}])
    expect(getSkippedFiles()).toEqual([
      expect.objectContaining({path: 'package.json', reason: 'unreadable', detail: 'manifest could not be parsed'}),
    ])
  })
})
