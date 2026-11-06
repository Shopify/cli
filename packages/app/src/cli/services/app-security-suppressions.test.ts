import {readAppSecuritySuppressions, type AppSecuritySuppression} from './app-security-suppressions.js'
import {appSecuritySuppressionsPath} from './app-security-artifacts.js'
import {projectAppSecurityPath} from './app-security/result.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fileExists, inTemporaryDirectory, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {symlink} from 'node:fs/promises'

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

const CONFIGURATION_PROBLEM =
  'must be an app configuration file name, such as shopify.app.toml, or a client ID passed with --client-id'

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

  // Windows PowerShell 5.1 writes one with `Set-Content -Encoding UTF8`.
  test('reads a file that starts with a UTF-8 byte order mark', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeSuppressionsFile(directory, `\uFEFF${suppressionsJson([agentEntry])}`)

      await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([agentEntry])
    })
  })

  test('reads a file with an empty list as no suppressions', async () => {
    await inTemporaryDirectory(async (directory) => {
      await writeSuppressionsFile(directory, suppressionsJson([]))

      await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([])
    })
  })

  describe('unknown keys', () => {
    test('rejects every key it does not know, so a field that a newer CLI adds is never dropped', async () => {
      await inTemporaryDirectory(async (directory) => {
        await writeSuppressionsFile(
          directory,
          JSON.stringify({
            schema_version: 1,
            generator: 'later-cli',
            suppressions: [{...agentEntry, expires: '2030-01-01', line: 12}],
          }),
        )

        await expect(readProblems(directory)).resolves.toStrictEqual([
          'unknown key "generator"',
          'suppressions[0]: unknown key "expires"',
          'suppressions[0]: unknown key "line"',
        ])
      })
    })

    // Read without its `code`, the entry would cover every finding of the check in the file.
    test('rejects a known key in another case and names the key it means', async () => {
      await expect(entryProblems({code: undefined, Code: deterministicEntry.code})).resolves.toStrictEqual([
        'suppressions[0]: unknown key "Code". Did you mean "code"?',
      ])
    })

    test('shortens a long unknown key', async () => {
      await expect(entryProblems({['k'.repeat(41)]: true})).resolves.toStrictEqual([
        `suppressions[0]: unknown key "${'k'.repeat(40)}…"`,
      ])
    })

    test('accepts a $schema string at the top level, for editors', async () => {
      await inTemporaryDirectory(async (directory) => {
        await writeSuppressionsFile(
          directory,
          JSON.stringify({$schema: './app-security.schema.json', schema_version: 1, suppressions: [agentEntry]}),
        )

        await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([agentEntry])
      })
    })

    test('rejects a $schema that is not a string', async () => {
      await inTemporaryDirectory(async (directory) => {
        await writeSuppressionsFile(directory, JSON.stringify({$schema: 1, schema_version: 1, suppressions: []}))

        await expect(readProblems(directory)).resolves.toStrictEqual(['$schema: must be a string'])
      })
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
      [
        'a misspelled check ID',
        {check: 'COMMITED_SECRET'},
        'suppressions[0].check: not a check ID that this version of Shopify CLI knows. Check the spelling, or upgrade Shopify CLI.',
      ],
      [
        'a check ID in lowercase',
        {check: 'committed_secret'},
        'suppressions[0].check: not a check ID that this version of Shopify CLI knows. Check the spelling, or upgrade Shopify CLI.',
      ],
      ['a missing check ID', {check: undefined}, 'suppressions[0].check: required'],
      ['an empty check ID', {check: ''}, 'suppressions[0].check: must not be empty'],
    ])('rejects %s', async (_name, changes, problem) => {
      await expect(entryProblems(changes)).resolves.toStrictEqual([problem])
    })

    test.each([
      [
        'deterministic',
        'SQL_INJECTION',
        'suppressions[0].check: deterministic checks in this version of Shopify CLI don\'t report SQL_INJECTION. Use "source": "agent", or upgrade Shopify CLI.',
      ],
      [
        'agent',
        'MISSING_DEPENDENCY_SECURITY_AUTOMATION',
        'suppressions[0].check: agent checks in this version of Shopify CLI don\'t report MISSING_DEPENDENCY_SECURITY_AUTOMATION. Use "source": "deterministic", or upgrade Shopify CLI.',
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
      ...[' app/session.ts', 'app/session.ts ', 'app/session.ts\n'].map((path) => [
        `the path ${JSON.stringify(path)}, with whitespace around it`,
        path,
        'suppressions[0].path: must not start or end with whitespace',
      ]),
      ['a NUL character', 'app/session\u0000.ts', "suppressions[0].path: can't contain a NUL character"],
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
      ...[';', ' , ', ',;\n'].map((code) => [
        `the code ${JSON.stringify(code)}`,
        {code},
        'suppressions[0].code: must contain more than whitespace, commas, and semicolons',
      ]),
    ])('rejects %s', async (_name, changes, problem) => {
      await expect(entryProblems(changes)).resolves.toStrictEqual([problem])
    })

    test.each([
      ['a configuration path', 'config/shopify.app.toml'],
      ['a configuration name without .toml', 'shopify.app.production'],
      ['a file name that is not an app configuration', 'shopify.app.toml.bak'],
      ['an app configuration file name with a space', 'shopify.app.my store.toml'],
      ['a name with a dot that is not an app configuration', 'production.toml'],
      ['a client ID with a space', 'client id'],
      ['an empty name', ''],
    ])('rejects %s as a configuration', async (_name, configuration) => {
      await expect(entryProblems({configurations: ['shopify.app.toml', configuration]})).resolves.toStrictEqual([
        `suppressions[0].configurations[1]: ${CONFIGURATION_PROBLEM}`,
      ])
    })

    test.each([' shopify.app.toml', 'shopify.app.toml ', '1234567890abcdef\t'])(
      'rejects the configuration %j, with whitespace around it',
      async (configuration) => {
        await expect(entryProblems({configurations: [configuration]})).resolves.toStrictEqual([
          'suppressions[0].configurations[0]: must not start or end with whitespace',
        ])
      },
    )

    test('accepts app configuration file names and client IDs as configurations', async () => {
      await inTemporaryDirectory(async (directory) => {
        const configurations = [
          'shopify.app.toml',
          'shopify.app.production.toml',
          'shopify.app.my-store_2.toml',
          '1234567890abcdef1234567890abcdef',
          'test-client-id',
        ]
        const entry = {...agentEntry, configurations}
        await writeSuppressionsFile(directory, suppressionsJson([entry]))

        await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([entry])
      })
    })
  })

  describe('duplicates', () => {
    test('rejects an entry with the same source, check, path, code, and configurations as an earlier one', async () => {
      await inTemporaryDirectory(async (directory) => {
        await writeSuppressionsFile(
          directory,
          suppressionsJson([
            deterministicEntry,
            agentEntry,
            {...deterministicEntry},
            {
              ...agentEntry,
              kind: 'false-positive',
              reason: 'Another reason.',
              configurations: [...agentEntry.configurations].reverse(),
            },
            {...deterministicEntry, configurations: ['shopify.app.toml', 'shopify.app.toml']},
          ]),
        )

        await expect(readProblems(directory)).resolves.toStrictEqual([
          'suppressions[2]: duplicates suppressions[0]',
          'suppressions[3]: duplicates suppressions[1]',
          'suppressions[4]: duplicates suppressions[0]',
        ])
      })
    })

    test('accepts entries that differ in source, check, path, code, or configurations', async () => {
      await inTemporaryDirectory(async (directory) => {
        const entries = [
          deterministicEntry,
          {...deterministicEntry, source: 'agent'},
          {...deterministicEntry, check: 'UNSAFE_INNERHTML'},
          {...deterministicEntry, path: 'test/fixtures/other-session.ts'},
          {...deterministicEntry, code: 'refreshToken: "shpa[REDACTED:38]"'},
          {
            source: deterministicEntry.source,
            check: deterministicEntry.check,
            kind: deterministicEntry.kind,
            path: deterministicEntry.path,
            reason: deterministicEntry.reason,
            configurations: deterministicEntry.configurations,
          },
          {...deterministicEntry, configurations: ['shopify.app.toml', 'shopify.app.production.toml']},
        ]
        await writeSuppressionsFile(directory, suppressionsJson(entries))

        await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual(entries)
      })
    })

    test('compares only entries that are valid on their own', async () => {
      await expect(
        inTemporaryDirectory(async (directory) => {
          await writeSuppressionsFile(
            directory,
            suppressionsJson([deterministicEntry, {...deterministicEntry, reason: ''}]),
          )
          return readProblems(directory)
        }),
      ).resolves.toStrictEqual(['suppressions[1].reason: must not be empty'])
    })
  })

  describe('the file', () => {
    test('rejects a symbolic link without reading the file it points to', async () => {
      await inTemporaryDirectory(async (directory) => {
        const targetPath = joinPath(directory, 'outside.env')
        await writeFile(targetPath, 'SHOPIFY_API_SECRET=fake-value-for-tests\n')
        await symlink(targetPath, appSecuritySuppressionsPath(directory), 'file')

        const error = await readError(directory)

        expect((error.details as {errors: string[]}).errors).toStrictEqual([
          'The file must be a regular file, not a symbolic link, a directory, or a special file.',
        ])
        expect(JSON.stringify(error.customSections)).not.toContain('SHOPIFY')
      })
    })

    test('rejects JSON that does not parse', async () => {
      await inTemporaryDirectory(async (directory) => {
        await writeSuppressionsFile(directory, '{"schema_version": 1, "suppressions": [')

        await expect(readProblems(directory)).resolves.toStrictEqual([expect.stringMatching(/^Could not parse JSON: /)])
      })
    })

    test('rejects JSON that does not parse without quoting the file', async () => {
      await inTemporaryDirectory(async (directory) => {
        const fakeToken = ['fake', 'token', '0'.repeat(16)].join('_')
        await writeSuppressionsFile(directory, `{"schema_version": 1, "suppressions": [{"code": ${fakeToken}}]}`)

        const error = await readError(directory)

        expect((error.details as {errors: string[]}).errors).toStrictEqual([
          expect.stringMatching(/^Could not parse JSON: /),
        ])
        expect(JSON.stringify([error.customSections, error.details])).not.toContain('fake_t')
      })
    })

    test.each([
      ['a later schema_version', 2, 'schema_version 2 needs a newer version of Shopify CLI'],
      ['a much later schema_version', 10, 'schema_version 10 needs a newer version of Shopify CLI'],
    ])('rejects %s and names the upgrade', async (_name, schemaVersion, problem) => {
      await inTemporaryDirectory(async (directory) => {
        await writeSuppressionsFile(directory, JSON.stringify({schema_version: schemaVersion, suppressions: []}))

        await expect(readProblems(directory)).resolves.toStrictEqual([problem])
      })
    })

    test.each([
      ['a schema_version of 0', {schema_version: 0, suppressions: []}],
      ['a schema_version that is not an integer', {schema_version: 1.5, suppressions: []}],
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

    test.each([
      [50, []],
      [51, ['\u2026and 1 more']],
      [60, ['\u2026and 10 more']],
    ])('lists at most 50 of %i problems, and counts the others', async (count, rest) => {
      await inTemporaryDirectory(async (directory) => {
        const entries = Array.from({length: count}, (_, index) => ({
          ...agentEntry,
          path: `app/${index}.ts`,
          reason: '',
        }))
        const path = await writeSuppressionsFile(directory, suppressionsJson(entries))

        const error = await readError(directory)

        const listed = [
          ...Array.from({length: 50}, (_, index) => `suppressions[${index}].reason: must not be empty`),
          ...rest,
        ]
        expect(error.customSections).toStrictEqual([{title: path, body: {list: {items: listed}}}])
        expect((error.details as {errors: string[]}).errors).toStrictEqual(listed)
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
          'suppressions[0].check: deterministic checks in this version of Shopify CLI don\'t report SQL_INJECTION. Use "source": "agent", or upgrade Shopify CLI.',
          'suppressions[2].kind: required (false-positive or accepted-risk)',
          'suppressions[2].reason: must not be empty',
          'suppressions[3].check: not a check ID that this version of Shopify CLI knows. Check the spelling, or upgrade Shopify CLI.',
        ])
        expect(JSON.stringify(error.customSections)).not.toContain(secretLikeValue)
      })
    })
  })
})
