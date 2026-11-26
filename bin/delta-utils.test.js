import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {mkdir, mkdtemp, rm, stat, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {test} from 'node:test'
import {pathToFileURL} from 'node:url'

import {createWorldPullRequest, getWorldHost} from './delta-utils.js'
import {runCommand} from './run-command.js'

const gitOptions = [
  '-c',
  'user.name=Release Test',
  '-c',
  'user.email=release@example.com',
  '-c',
  'commit.gpgsign=false',
  '-c',
  'core.fsmonitor=false',
]
const docsPath = 'areas/platforms/shopify-dev/docs.json'
const releaseOptions = {
  branch: 'shopify-cli-5.0.1',
  base: 'main',
  title: 'Update CLI docs',
  body: 'Release documentation\n\nVersion 5.0.1',
  commitMessage: 'Update CLI documentation to 5.0.1',
  files: {[docsPath]: 'Updated documentation — 日本語\n'},
}
const worldHost = 'https://code.example.test'
const pullRequest = {number: 2200001, html_url: `${worldHost}/shop/world/pull/2200001`}

async function fixture(context, {existingPullRequests = [], beforePush} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cli-delta-test-'))
  context.after(() => rm(root, {recursive: true, force: true}))
  const origin = join(root, 'origin.git')
  const source = join(root, 'source')
  const git = (directory, ...args) =>
    execFileSync('git', [...gitOptions, '-C', directory, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

  await mkdir(source)
  git(root, 'init', '--bare', '--initial-branch=main', origin)
  git(origin, 'config', 'uploadpack.allowFilter', 'true')
  git(source, 'init', '--initial-branch=main')
  await mkdir(join(source, 'areas/platforms/shopify-dev'), {recursive: true})
  await writeFile(join(source, docsPath), 'Original documentation\n')
  await writeFile(join(source, 'unrelated.txt'), 'Unrelated content\n')
  git(source, 'add', '.')
  git(source, 'commit', '-m', 'Initial documentation')
  git(source, 'remote', 'add', 'origin', origin)
  git(source, 'push', 'origin', 'main')

  const commands = []
  let cloneDirectory
  const executeCommand = async (command, args, options) => {
    commands.push({command, args, options})
    if (command === 'git') {
      if (args[0] === 'config') return runCommand(command, [...gitOptions, '-C', source, ...args], options)
      if (args[0] === 'clone') cloneDirectory = args.at(-1)
      if (args[2] === 'add') assert.equal(existsSync(join(cloneDirectory, 'unrelated.txt')), false)
      if (args[2] === 'push') await beforePush?.({origin, source, git})
      return runCommand(command, [...gitOptions, ...args], options)
    }

    assert.equal(command, 'dt')
    assert.deepEqual(args.slice(0, 4), ['--host', worldHost, '--repo', 'shop/world'])
    if (args[4] === 'api') {
      assert.equal(args[5], `repos/shop/world/branches/${releaseOptions.branch}`)
      try {
        git(origin, 'show-ref', '--verify', `refs/heads/${releaseOptions.branch}`)
      } catch {
        throw new Error('Command failed with exit code 1\nError: 404: branch not found\n')
      }
      return '{}'
    }
    if (args[5] === 'list') return JSON.stringify(existingPullRequests)
    assert.equal(args[5], 'create')
    return JSON.stringify(pullRequest)
  }

  return {
    origin,
    source,
    git,
    commands,
    dependencies: {executeCommand, repositoryUrl: pathToFileURL(origin).href, environment: {WGH_HOST: worldHost}},
    assertCloneRemoved: () => assert.rejects(stat(cloneDirectory), {code: 'ENOENT'}),
  }
}

test('uses WGH_HOST without reading Git configuration', async () => {
  assert.equal(
    await getWorldHost({
      environment: {WGH_HOST: worldHost},
      executeCommand: async () => assert.fail('Git configuration must not override WGH_HOST'),
    }),
    worldHost,
  )
})

test('accepts a hostname without a scheme from local settings', async () => {
  assert.equal(await getWorldHost({environment: {WGH_HOST: 'code.example.test/'}}), worldHost)
})

test('reads the host from real local Git configuration when WGH_HOST is unset', async (context) => {
  const setup = await fixture(context)
  setup.git(setup.source, 'config', 'wgh.host', worldHost)

  const result = await createWorldPullRequest(releaseOptions, {...setup.dependencies, environment: {}})

  assert.deepEqual(result, {number: pullRequest.number, url: pullRequest.html_url})
  assert.deepEqual(setup.commands[0].args, ['config', '--get', '--default', '', 'wgh.host'])
  await setup.assertCloneRemoved()
})

test('stops before contacting Delta when no local host is configured', async (context) => {
  const setup = await fixture(context)
  setup.git(setup.source, 'config', 'wgh.host', '')

  await assert.rejects(
    createWorldPullRequest(releaseOptions, {...setup.dependencies, environment: {}}),
    /Set WGH_HOST or run `git config wgh.host <host>`/,
  )

  assert.deepEqual(
    setup.commands.map(({command}) => command),
    ['git'],
  )
})

test('does not hide errors while reading Git configuration', async () => {
  const error = new Error('Invalid Git configuration')

  await assert.rejects(
    getWorldHost({
      environment: {},
      executeCommand: async () => {
        throw error
      },
    }),
    error,
  )
})

test('builds the clone URL from the locally configured host', async () => {
  const error = new Error('Stop before cloning')
  let directory

  await assert.rejects(
    createWorldPullRequest(releaseOptions, {
      environment: {WGH_HOST: worldHost},
      executeCommand: async (command, args) => {
        if (command === 'dt') return '{}'
        assert.equal(command, 'git')
        assert.equal(args[0], 'clone')
        assert.equal(args.at(-2), `${worldHost}/shop/world.git`)
        directory = args.at(-1)
        throw error
      },
    }),
    error,
  )

  await assert.rejects(stat(directory), {code: 'ENOENT'})
})

test('pushes only documentation changes and creates a Delta PR outside a World checkout', async (context) => {
  const setup = await fixture(context)
  const newPath = 'areas/platforms/shopify-dev/new-docs.json'

  const result = await createWorldPullRequest(
    {
      ...releaseOptions,
      files: {...releaseOptions.files, [newPath]: 'New documentation\n'},
    },
    setup.dependencies,
  )

  assert.deepEqual(result, {number: pullRequest.number, url: pullRequest.html_url})
  assert.equal(
    setup.git(setup.origin, 'show', `${releaseOptions.branch}:${docsPath}`),
    releaseOptions.files[docsPath].trim(),
  )
  assert.equal(setup.git(setup.origin, 'show', `${releaseOptions.branch}:${newPath}`), 'New documentation')
  assert.equal(setup.git(setup.origin, 'show', `main:${docsPath}`), 'Original documentation')
  assert.deepEqual(setup.git(setup.origin, 'diff', '--name-only', `main..${releaseOptions.branch}`).split('\n'), [
    docsPath,
    newPath,
  ])
  assert.equal(setup.git(setup.origin, 'log', '-1', '--format=%s', releaseOptions.branch), releaseOptions.commitMessage)
  assert.deepEqual(setup.commands.find(({args}) => args[5] === 'create').args, [
    '--host',
    worldHost,
    '--repo',
    'shop/world',
    'pr',
    'create',
    '--head',
    releaseOptions.branch,
    '--base',
    'main',
    '--title',
    releaseOptions.title,
    '--body',
    releaseOptions.body,
    '--publish',
    '--json',
  ])
  const clone = setup.commands.find(({args}) => args[0] === 'clone')
  for (const flag of ['--depth=1', '--filter=blob:none', '--no-checkout', '--single-branch', '--no-tags']) {
    assert.ok(clone.args.includes(flag))
  }
  await setup.assertCloneRemoved()
})

test('keeps existing branch changes and reuses its open Delta PR', async (context) => {
  const setup = await fixture(context, {existingPullRequests: [pullRequest]})
  setup.git(setup.source, 'checkout', '-b', releaseOptions.branch)
  await writeFile(join(setup.source, 'unrelated.txt'), 'Existing branch change\n')
  setup.git(setup.source, 'commit', '-am', 'Existing branch change')
  setup.git(setup.source, 'push', 'origin', releaseOptions.branch)

  const result = await createWorldPullRequest(releaseOptions, setup.dependencies)

  assert.deepEqual(result, {number: pullRequest.number, url: pullRequest.html_url})
  assert.equal(setup.git(setup.origin, 'show', `${releaseOptions.branch}:unrelated.txt`), 'Existing branch change')
  assert.equal(setup.git(setup.origin, 'rev-list', '--count', `main..${releaseOptions.branch}`), '2')
  assert.equal(
    setup.commands.some(({args}) => args[5] === 'create'),
    false,
  )
  await setup.assertCloneRemoved()
})

test('does not commit, push, or create a PR when documentation is unchanged', async (context) => {
  const setup = await fixture(context)

  const result = await createWorldPullRequest(
    {
      ...releaseOptions,
      files: {[docsPath]: 'Original documentation\n'},
    },
    setup.dependencies,
  )

  assert.equal(result, undefined)
  assert.equal(
    setup.commands.some(({args}) => ['commit', 'push'].includes(args[2])),
    false,
  )
  assert.equal(setup.commands.filter(({command}) => command === 'dt').length, 1)
  await setup.assertCloneRemoved()
})

test('does not add a commit or another PR when rerun after a successful update', async (context) => {
  const setup = await fixture(context)
  await createWorldPullRequest(releaseOptions, setup.dependencies)
  const head = setup.git(setup.origin, 'rev-parse', releaseOptions.branch)
  setup.commands.length = 0

  assert.equal(await createWorldPullRequest(releaseOptions, setup.dependencies), undefined)
  assert.equal(setup.git(setup.origin, 'rev-parse', releaseOptions.branch), head)
  assert.equal(setup.commands.filter(({command}) => command === 'dt').length, 1)
  await setup.assertCloneRemoved()
})

test('rejects a concurrent branch update without overwriting it or creating a PR', async (context) => {
  const setup = await fixture(context, {
    beforePush: async ({source, git}) => {
      await writeFile(join(source, 'unrelated.txt'), 'Concurrent branch change\n')
      git(source, 'commit', '-am', 'Concurrent branch change')
      git(source, 'push', 'origin', releaseOptions.branch)
    },
  })
  setup.git(setup.source, 'checkout', '-b', releaseOptions.branch)
  setup.git(setup.source, 'push', 'origin', releaseOptions.branch)

  await assert.rejects(createWorldPullRequest(releaseOptions, setup.dependencies), /rejected/)

  assert.equal(setup.git(setup.origin, 'show', `${releaseOptions.branch}:unrelated.txt`), 'Concurrent branch change')
  assert.equal(setup.git(setup.origin, 'show', `${releaseOptions.branch}:${docsPath}`), 'Original documentation')
  assert.equal(setup.commands.filter(({command}) => command === 'dt').length, 1)
  await setup.assertCloneRemoved()
})

for (const message of ['Error: 403: forbidden', 'Error: DNS lookup failed']) {
  test(`does not treat ${message} as a missing branch`, async () => {
    const error = new Error(message)
    const commands = []
    await assert.rejects(
      createWorldPullRequest(releaseOptions, {
        environment: {WGH_HOST: worldHost},
        executeCommand: async (command) => {
          commands.push(command)
          throw error
        },
      }),
      error,
    )
    assert.deepEqual(commands, ['dt'])
  })
}

test('removes the temporary checkout when cloning fails', async (context) => {
  const setup = await fixture(context)

  await assert.rejects(
    createWorldPullRequest(releaseOptions, {
      ...setup.dependencies,
      repositoryUrl: join(setup.origin, 'missing'),
    }),
    /Command failed/,
  )

  await setup.assertCloneRemoved()
  assert.equal(setup.commands.filter(({command}) => command === 'dt').length, 1)
})

test('removes the temporary checkout and does not create a PR when pushing fails', async (context) => {
  const setup = await fixture(context)
  await writeFile(join(setup.origin, 'hooks/pre-receive'), '#!/bin/sh\nexit 1\n', {mode: 0o755})

  await assert.rejects(createWorldPullRequest(releaseOptions, setup.dependencies), /pre-receive hook declined/)

  await setup.assertCloneRemoved()
  assert.equal(setup.commands.filter(({command}) => command === 'dt').length, 1)
  assert.equal(setup.git(setup.origin, 'show', `main:${docsPath}`), 'Original documentation')
})
