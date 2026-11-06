import {
  missingSuppressionPaths,
  readAppSecuritySuppressions,
  type AppSecuritySuppression,
} from './app-security-suppressions.js'
import {appSecuritySuppressionsPath} from './app-security-artifacts.js'
import {projectAppSecurityPath} from './app-security/result.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {chmod, fileExists, fileRealPath, inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'

const deterministicEntry: AppSecuritySuppression = {
  source: 'deterministic',
  check: 'COMMITTED_SECRET',
  kind: 'false-positive',
  path: 'test/fixtures/session.ts',
  code: 'accessToken: "shpa[REDACTED:38]"',
  reason: 'Fake token in a unit test fixture.',
  configurations: ['shopify.app.toml'],
}

const agentEntry: AppSecuritySuppression = {
  source: 'agent',
  check: 'SCOPE_OVER_REQUEST',
  kind: 'accepted-risk',
  path: 'shopify.app.toml',
  reason: 'Kept until the app embed migration ships.',
  configurations: ['shopify.app.toml', 'shopify.app.production.toml'],
}

async function writeSuppressionsFile(appDirectory: string, contents: string): Promise<string> {
  const path = appSecuritySuppressionsPath(appDirectory)
  await writeFile(path, contents)
  return path
}

function suppressionsJson(suppressions: unknown[]): string {
  return JSON.stringify({schema_version: 1, suppressions}, null, 2)
}

async function readError(appDirectory: string): Promise<AbortError> {
  const error: unknown = await readAppSecuritySuppressions(appDirectory).catch((error: unknown) => error)
  expect(error).toBeInstanceOf(AbortError)
  return error as AbortError
}

/** The problems the error lists, in order. */
async function readProblems(appDirectory: string): Promise<string[]> {
  const error = await readError(appDirectory)
  return (error.details as {errors: string[]}).errors
}

/** The problems with one entry that is the valid deterministic entry with `changes` applied. */
async function entryProblems(changes: Record<string, unknown>): Promise<string[]> {
  return inTemporaryDirectory(async (directory) => {
    await writeSuppressionsFile(directory, suppressionsJson([{...deterministicEntry, ...changes}]))
    return readProblems(directory)
  })
}

describe('readAppSecuritySuppressions', () => {
  test('reads a valid file into typed entries, in the order of the file', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeSuppressionsFile(directory, suppressionsJson([deterministicEntry, agentEntry]))

      await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([deterministicEntry, agentEntry])
    })
  })

  test('accepts a check ID that both sources report, for either source', async () => {
    await inTemporaryDirectory(async (directory) => {
      const agentSecret = {...deterministicEntry, source: 'agent'}
      await writeSuppressionsFile(directory, suppressionsJson([deterministicEntry, agentSecret]))

      await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([deterministicEntry, agentSecret])
    })
  })

  test('reads a missing file as no suppressions, and creates nothing', async () => {
    await inTemporaryDirectory(async (directory) => {
      await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([])
      await expect(fileExists(appSecuritySuppressionsPath(directory))).resolves.toBe(false)
    })
  })

  test('reads a file with an empty list as no suppressions', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeSuppressionsFile(directory, suppressionsJson([]))

      await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([])
    })
  })

  test('drops keys it does not know, so a later CLI can add optional fields', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeSuppressionsFile(
        directory,
        JSON.stringify({schema_version: 1, generator: 'later-cli', suppressions: [{...agentEntry, added: true}]}),
      )

      await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([agentEntry])
    })
  })

  test('rejects an invalid file with one error that names the file and lists its problems', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = await writeSuppressionsFile(directory, suppressionsJson([{...deterministicEntry, reason: ''}]))

      const error = await readError(directory)

      expect(error.message).toBe(
        'The app security suppressions could not be loaded because shopify.app-security.json is invalid.',
      )
      expect(error.nextSteps).toStrictEqual([
        'Fix every error in shopify.app-security.json, then run the command again.',
      ])
      expect(error.customSections).toStrictEqual([
        {title: path, body: {list: {items: ['suppressions[0].reason: must not be empty']}}},
      ])
      expect(error.code).toBe('suppressions-file-invalid')
      expect(error.details).toStrictEqual({
        path: projectAppSecurityPath(path),
        errors: ['suppressions[0].reason: must not be empty'],
      })
    })
  })

  describe('reason', () => {
    test.each([
      ['an empty reason', {reason: ''}, 'suppressions[0].reason: must not be empty'],
      ['a reason of only spaces', {reason: '   \n'}, 'suppressions[0].reason: must not be empty'],
      ['a missing reason', {reason: undefined}, 'suppressions[0].reason: required'],
      ['a reason that is not a string', {reason: 42}, 'suppressions[0].reason: must be a string'],
      [
        'a reason longer than an agent justification can be',
        {reason: 'x'.repeat(4_001)},
        'suppressions[0].reason: must be at most 4000 characters',
      ],
    ])('rejects %s', async (_name, changes, problem) => {
      await expect(entryProblems(changes)).resolves.toStrictEqual([problem])
    })

    test('accepts a reason as long as an agent justification can be', async () => {
      await inTemporaryDirectory(async (directory) => {
        await writeSuppressionsFile(directory, suppressionsJson([{...deterministicEntry, reason: 'x'.repeat(4_000)}]))

        await expect(readAppSecuritySuppressions(directory)).resolves.toHaveLength(1)
      })
    })
  })

  describe('kind', () => {
    test.each([
      ['a missing kind', {kind: undefined}, 'suppressions[0].kind: required (false-positive or accepted-risk)'],
      ['an unknown kind', {kind: 'wont-fix'}, 'suppressions[0].kind: must be false-positive or accepted-risk'],
      [
        'false_positive, with an underscore',
        {kind: 'false_positive'},
        'suppressions[0].kind: must be false-positive or accepted-risk',
      ],
      [
        'accepted_risk, with an underscore',
        {kind: 'accepted_risk'},
        'suppressions[0].kind: must be false-positive or accepted-risk',
      ],
    ])('rejects %s', async (_name, changes, problem) => {
      await expect(entryProblems(changes)).resolves.toStrictEqual([problem])
    })
  })

  describe('source', () => {
    test.each([
      ['a missing source', {source: undefined}, 'suppressions[0].source: required (deterministic or agent)'],
      ['an unknown source', {source: 'manual'}, 'suppressions[0].source: must be deterministic or agent'],
    ])('rejects %s', async (_name, changes, problem) => {
      await expect(entryProblems(changes)).resolves.toStrictEqual([problem])
    })
  })

  describe('check', () => {
    test.each([
      ['an unknown check ID', {check: 'COMMITED_SECRET'}, 'suppressions[0].check: not a known check ID'],
      ['a check ID in lowercase', {check: 'committed_secret'}, 'suppressions[0].check: not a known check ID'],
      ['a missing check ID', {check: undefined}, 'suppressions[0].check: required'],
      ['an empty check ID', {check: ''}, 'suppressions[0].check: must not be empty'],
    ])('rejects %s', async (_name, changes, problem) => {
      await expect(entryProblems(changes)).resolves.toStrictEqual([problem])
    })

    test.each([
      [
        'deterministic',
        'SQL_INJECTION',
        'suppressions[0].check: deterministic checks don\'t report SQL_INJECTION. Use "source": "agent".',
      ],
      [
        'agent',
        'MISSING_DEPENDENCY_SECURITY_AUTOMATION',
        'suppressions[0].check: agent checks don\'t report MISSING_DEPENDENCY_SECURITY_AUTOMATION. Use "source": "deterministic".',
      ],
    ])('rejects the source %s for %s, which only the other source reports', async (source, check, problem) => {
      await expect(entryProblems({source, check})).resolves.toStrictEqual([problem])
    })
  })

  describe('path', () => {
    test.each([
      ['a * wildcard', 'app/routes/*.ts', "suppressions[0].path: can't contain wildcards: name one file"],
      ['a ** glob', 'app/**/session.ts', "suppressions[0].path: can't contain wildcards: name one file"],
      ['a ? wildcard', 'app/routes/route?.ts', "suppressions[0].path: can't contain wildcards: name one file"],
      ['an absolute path', '/home/dev/app/session.ts', 'suppressions[0].path: must be relative to the app directory'],
      ['a Windows drive path', 'C:/app/session.ts', 'suppressions[0].path: must be relative to the app directory'],
      ['backslashes', 'test\\fixtures\\session.ts', 'suppressions[0].path: must use / as the separator'],
      ['an empty path', '', 'suppressions[0].path: must not be empty'],
      ...['./test/session.ts', 'test//session.ts', 'test/../session.ts', 'test/', '..'].map((path) => [
        `the unnormalized path ${path}`,
        path,
        'suppressions[0].path: must name a file, without empty or "." segments, and with ".." only at the start',
      ]),
    ])('rejects %s', async (_name, path, problem) => {
      await expect(entryProblems({path})).resolves.toStrictEqual([problem])
    })

    test('accepts a path outside the app directory and a React Router route name with brackets', async () => {
      await inTemporaryDirectory(async (directory) => {
        const entries = [
          {...deterministicEntry, path: '../shared/session.ts'},
          {...deterministicEntry, path: 'app/routes/sitemap[.]xml.tsx'},
        ]
        await writeSuppressionsFile(directory, suppressionsJson(entries))

        await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual(entries)
      })
    })
  })

  describe('code and configurations', () => {
    test.each([
      ['an empty code', {code: ' '}, 'suppressions[0].code: must not be empty'],
      ['a missing configurations list', {configurations: undefined}, 'suppressions[0].configurations: required'],
      [
        'an empty configurations list',
        {configurations: []},
        'suppressions[0].configurations: must list at least one app configuration',
      ],
      [
        'a configuration path',
        {configurations: ['shopify.app.toml', 'config/shopify.app.toml']},
        'suppressions[0].configurations[1]: must be an app configuration file name, such as shopify.app.toml, or a client ID',
      ],
    ])('rejects %s', async (_name, changes, problem) => {
      await expect(entryProblems(changes)).resolves.toStrictEqual([problem])
    })

    test('accepts a client ID as a configuration', async () => {
      await inTemporaryDirectory(async (directory) => {
        const entry = {...agentEntry, configurations: ['1234567890abcdef1234567890abcdef']}
        await writeSuppressionsFile(directory, suppressionsJson([entry]))

        await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([entry])
      })
    })
  })

  describe('the file', () => {
    test('rejects JSON that does not parse', async () => {
      await inTemporaryDirectory(async (directory) => {
        await writeSuppressionsFile(directory, '{"schema_version": 1, "suppressions": [')

        await expect(readProblems(directory)).resolves.toStrictEqual([expect.stringMatching(/^Could not parse JSON: /)])
      })
    })

    test.each([
      ['an unknown schema_version', {schema_version: 2, suppressions: []}],
      ['a schema_version that is a string', {schema_version: '1', suppressions: []}],
      ['a missing schema_version', {suppressions: [deterministicEntry]}],
    ])('rejects %s', async (_name, document) => {
      await inTemporaryDirectory(async (directory) => {
        await writeSuppressionsFile(directory, JSON.stringify(document))

        await expect(readProblems(directory)).resolves.toStrictEqual(['schema_version must be 1'])
      })
    })

    test.each([
      ['JSON that is not an object', [deterministicEntry], 'expected a JSON object, received array'],
      ['a missing suppressions list', {schema_version: 1}, 'suppressions: required'],
      [
        'a suppressions value that is not a list',
        {schema_version: 1, suppressions: {}},
        'suppressions: must be an array',
      ],
      [
        'an entry that is not an object',
        {schema_version: 1, suppressions: ['COMMITTED_SECRET']},
        'suppressions[0]: must be an object',
      ],
    ])('rejects %s', async (_name, document, problem) => {
      await inTemporaryDirectory(async (directory) => {
        await writeSuppressionsFile(directory, JSON.stringify(document))

        await expect(readProblems(directory)).resolves.toStrictEqual([problem])
      })
    })

    test('reports every problem of every invalid entry in one error, in entry order, and applies none', async () => {
      await inTemporaryDirectory(async (directory) => {
        // Built at runtime so that the source holds no token-shaped literal for secret scanners to flag.
        const secretLikeValue = ['shpat', '_', '0'.repeat(32)].join('')
        await writeSuppressionsFile(
          directory,
          suppressionsJson([
            {...deterministicEntry, check: 'SQL_INJECTION', path: `app/${secretLikeValue}/*.ts`},
            agentEntry,
            {...agentEntry, kind: undefined, reason: ''},
            {...deterministicEntry, check: 'NOT_A_CHECK', source: 'agent'},
          ]),
        )

        const error = await readError(directory)

        expect((error.details as {errors: string[]}).errors).toStrictEqual([
          "suppressions[0].path: can't contain wildcards: name one file",
          'suppressions[0].check: deterministic checks don\'t report SQL_INJECTION. Use "source": "agent".',
          'suppressions[2].kind: required (false-positive or accepted-risk)',
          'suppressions[2].reason: must not be empty',
          'suppressions[3].check: not a known check ID',
        ])
        expect(JSON.stringify(error.customSections)).not.toContain(secretLikeValue)
      })
    })
  })
})

describe('missingSuppressionPaths', () => {
  test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'does not treat an inaccessible file as missing',
    async () => {
      await inTemporaryDirectory(async (directory) => {
        const locked = joinPath(directory, 'locked')
        const file = joinPath(locked, 'session.ts')
        await mkdir(locked)
        await writeFile(file, 'export {}\n')
        await chmod(locked, 0o000)
        try {
          await expect(fileRealPath(file)).rejects.toMatchObject({code: 'EACCES'})
          await expect(
            missingSuppressionPaths(directory, [{...deterministicEntry, path: 'locked/session.ts'}]),
          ).resolves.toEqual([])
        } finally {
          await chmod(locked, 0o700)
        }
        await expect(fileExists(file)).resolves.toBe(true)
      })
    },
  )

  test('treats a path below a regular file as missing', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeFile(joinPath(directory, 'parent'), 'export {}\n')
      await expect(
        missingSuppressionPaths(directory, [{...deterministicEntry, path: 'parent/session.ts'}]),
      ).resolves.toEqual(['parent/session.ts'])
    })
  })

  test('gives the paths of the entries with code whose files are gone, once each', async () => {
    await inTemporaryDirectory(async (directory) => {
      await mkdir(joinPath(directory, 'app', 'routes'))
      await writeFile(joinPath(directory, 'app', 'routes', 'index.ts'), 'export {}\n')
      const entries: AppSecuritySuppression[] = [
        {...deterministicEntry, path: 'app/routes/index.ts'},
        {...deterministicEntry, path: 'app/routes/session.ts'},
        {...deterministicEntry, path: 'app/routes/session.ts', check: 'CREDENTIAL_LOG_LEAKAGE'},
        // Without code, an entry gets no likely path, so its file isn't tested.
        {...agentEntry, path: 'app/routes/deleted.ts'},
      ]

      await expect(missingSuppressionPaths(directory, entries)).resolves.toEqual(['app/routes/session.ts'])
    })
  })

  test('resolves the paths against the app directory, also outside it', async () => {
    await inTemporaryDirectory(async (directory) => {
      const appDirectory = joinPath(directory, 'app')
      await mkdir(joinPath(directory, 'backend'))
      await writeFile(joinPath(directory, 'backend', 'server.ts'), 'export {}\n')
      const entries = [
        {...deterministicEntry, path: '../backend/server.ts'},
        {...deterministicEntry, path: '../backend/removed.ts'},
      ]

      await expect(missingSuppressionPaths(appDirectory, entries)).resolves.toEqual(['../backend/removed.ts'])
    })
  })
})
