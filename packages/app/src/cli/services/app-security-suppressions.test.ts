import {
  findingWithExcerpt,
  storedAgentDocument,
  deterministicFindingsDocument,
} from './app-security-engine/tests/fixtures/findings-documents.js'
import {
  missingSuppressionPaths,
  parseSuppressionFlags,
  planSuppression,
  readAppSecuritySuppressions,
  saveAppSecuritySuppressions,
  type AppSecuritySuppression,
  type SuppressionResults,
  type SuppressionTarget,
} from './app-security-suppressions.js'
import {appSecuritySuppressionsPath} from './app-security-artifacts.js'
import {projectAppSecurityPath} from './app-security/result.js'
import {
  combineFindings,
  type AgentFindingsDocument,
  type DeterministicFindingsDocument,
  type StoredFinding,
} from './app-security-engine/index.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {
  chmod,
  fileExists,
  fileRealPath,
  inTemporaryDirectory,
  mkdir,
  readFile,
  writeFile,
} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import {readdir, stat, symlink} from 'node:fs/promises'

const deterministicEntry: AppSecuritySuppression = {
  source: 'deterministic',
  check: 'COMMITTED_SECRET',
  kind: 'false-positive',
  path: 'test/fixtures/session.ts',
  code: 'accessToken: "shpa[REDACTED:38]"',
  reason: 'Fake token in a unit test fixture.',
}

const agentEntry: AppSecuritySuppression = {
  source: 'agent',
  check: 'SCOPE_OVER_REQUEST',
  kind: 'accepted-risk',
  path: 'shopify.app.toml',
  reason: 'Kept until the app embed migration ships.',
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
      [
        'a path longer than a finding location can be',
        'a'.repeat(1_025),
        'suppressions[0].path: must be at most 1024 characters',
      ],
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

    test('accepts a path as long as a finding location can be', async () => {
      await inTemporaryDirectory(async (directory) => {
        const entry = {...deterministicEntry, path: 'a'.repeat(1_024)}
        await writeSuppressionsFile(directory, suppressionsJson([entry]))

        await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([entry])
      })
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

  describe('code', () => {
    test.each([
      ['an empty code', {code: ' '}, 'suppressions[0].code: must not be empty'],
      [
        'a code longer than a finding snippet can be',
        {code: 'x'.repeat(4_001)},
        'suppressions[0].code: must be at most 4000 characters',
      ],
      ...[';', ' , ', ',;\n'].map((code): [string, Record<string, unknown>, string] => [
        `the code ${JSON.stringify(code)}`,
        {code},
        'suppressions[0].code: must contain more than whitespace, commas, and semicolons',
      ]),
    ])('rejects %s', async (_name, changes, problem) => {
      await expect(entryProblems(changes)).resolves.toStrictEqual([problem])
    })

    test('accepts a code as long as a finding snippet can be', async () => {
      await inTemporaryDirectory(async (directory) => {
        const entry = {...deterministicEntry, code: 'x'.repeat(4_000)}
        await writeSuppressionsFile(directory, suppressionsJson([entry]))

        await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([entry])
      })
    })

    test('rejects configuration scoping from prototype files instead of silently widening it', async () => {
      await expect(entryProblems({configurations: ['shopify.app.production.toml']})).resolves.toStrictEqual([
        'suppressions[0]: configurations is no longer supported. Suppressions apply to all app configurations; remove this field.',
      ])
    })
  })

  describe('duplicates', () => {
    test('rejects an entry with the same source, check, path and code as an earlier one', async () => {
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
            },
          ]),
        )

        await expect(readProblems(directory)).resolves.toStrictEqual([
          'suppressions[2]: duplicates suppressions[0]',
          'suppressions[3]: duplicates suppressions[1]',
        ])
      })
    })

    test('accepts entries that differ in source, check, path or code', async () => {
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
          },
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

describe('parseSuppressionFlags', () => {
  test('takes --kind with the spelling of the file, and keeps --reason as typed', () => {
    expect(parseSuppressionFlags({kind: 'false-positive', reason: 'A test fixture.'})).toStrictEqual({
      ok: true,
      decision: {kind: 'false-positive', reason: 'A test fixture.'},
    })
    expect(parseSuppressionFlags({kind: 'accepted-risk', reason: ' Kept for now. '})).toStrictEqual({
      ok: true,
      decision: {kind: 'accepted-risk', reason: ' Kept for now. '},
    })
  })

  test.each([
    ['a missing kind', {kind: undefined, reason: 'r'}, ['--kind: required (false-positive or accepted-risk)']],
    ['an unknown kind', {kind: 'wont_fix', reason: 'r'}, ['--kind: must be false-positive or accepted-risk']],
    [
      'a kind spelled with an underscore',
      {kind: 'false_positive', reason: 'r'},
      ['--kind: must be false-positive or accepted-risk'],
    ],
    ['a missing reason', {kind: 'false-positive', reason: undefined}, ['--reason: required']],
    ['an empty reason', {kind: 'false-positive', reason: ''}, ['--reason: must not be empty']],
    ['a reason of only spaces', {kind: 'false-positive', reason: '  '}, ['--reason: must not be empty']],
    [
      'a reason longer than the file allows',
      {kind: 'false-positive', reason: 'x'.repeat(4_001)},
      ['--reason: must be at most 4000 characters'],
    ],
    [
      'both flags missing',
      {kind: undefined, reason: undefined},
      ['--kind: required (false-positive or accepted-risk)', '--reason: required'],
    ],
  ])('rejects %s with the words of the file validation', (_name, flags, errors) => {
    expect(parseSuppressionFlags(flags)).toStrictEqual({ok: false, errors})
  })
})

/** An agent finding at `line` of `file`, with the lines around it as its excerpt. */
function agentFinding(file: string, line: number, lines: string[], message: string): StoredFinding {
  return findingWithExcerpt({location: {file, line}, message, evidence: [{location: {file, line}}]}, lines)
}

function agentDocument(checkId: string, findings: StoredFinding[]): AgentFindingsDocument {
  return storedAgentDocument({checkId, findings, generatedAt: '2026-09-01T11:00:00.000Z', precedence: 'union'})
}

function resultsOf(document: AgentFindingsDocument): SuppressionResults {
  return {deterministic: null, agent: document}
}

function targetOf(document: AgentFindingsDocument, findingIndex: number): SuppressionTarget {
  const [check] = document.checks
  return {source: 'agent', checkId: check!.id, findingIndex, finding: check!.findings[findingIndex]!}
}

const decision = {kind: 'false-positive', reason: 'The logger redacts tokens.'} as const

const routeLines = [
  'export async function loader({request}) {',
  '  const {session} = await authenticate.admin(request)',
  '  console.log(session.accessToken)',
  '  return null',
  '}',
  'export async function action({request}) {',
  '  const {session} = await authenticate.admin(request)',
  '  logger.info(',
  '    session.accessToken,',
  '  )',
  '  console.log(session.accessToken)',
  '  return null',
  '}',
]

describe('planSuppression', () => {
  test('names the finding by its flagged line', () => {
    const document = agentDocument('CREDENTIAL_LOG_LEAKAGE', [
      agentFinding('app/routes/orders.tsx', 3, routeLines.slice(0, 5), 'The access token reaches a log.'),
    ])

    expect(planSuppression(targetOf(document, 0), decision, resultsOf(document), [])).toStrictEqual({
      status: 'change',
      change: {
        type: 'add',
        entry: {
          source: 'agent',
          check: 'CREDENTIAL_LOG_LEAKAGE',
          kind: 'false-positive',
          path: 'app/routes/orders.tsx',
          code: 'console.log(session.accessToken)',
          reason: 'The logger redacts tokens.',
        },
      },
    })
  })

  test('widens the code to more of the statement when the flagged line also names another finding', () => {
    const document = agentDocument('CREDENTIAL_LOG_LEAKAGE', [
      agentFinding('app/routes/orders.tsx', 3, routeLines, 'The access token reaches a log.'),
      agentFinding('app/routes/orders.tsx', 11, routeLines, 'The access token reaches a log.'),
    ])

    const plans = [0, 1].map((index) => planSuppression(targetOf(document, index), decision, resultsOf(document), []))

    expect(plans).toMatchObject([
      {
        status: 'change',
        change: {entry: {code: 'const {session} = await authenticate.admin(request) console.log(session.accessToken)'}},
      },
      // `)` and `return null` follow the first finding's line too, so the code needs the line before the `)`.
      {
        status: 'change',
        change: {entry: {code: 'session.accessToken, ) console.log(session.accessToken) return null'}},
      },
    ])
    // Each entry suppresses its own finding, and no other one.
    for (const [index, plan] of plans.entries()) {
      const entry = plan.status === 'change' && plan.change.type === 'add' ? plan.change.entry : undefined
      const {checks, suppressions} = combineFindings({
        deterministic: null,
        agent: document,
        suppressions: {entries: [entry!]},
      })
      expect(suppressions[0]).toMatchObject({status: 'matched', matched_finding_count: 1})
      expect(checks[0]!.findings.map((finding) => finding.disposition)).toStrictEqual(
        index === 0 ? ['suppressed', 'active'] : ['active', 'suppressed'],
      )
    }
  })

  test('names a finding by a word of its line that its message names, when another finding shares the line', () => {
    const lines = ['[access_scopes]', 'scopes = "write_script_tags,read_orders"']
    const document = agentDocument('SCOPE_OVER_REQUEST', [
      agentFinding('shopify.app.toml', 2, lines, 'The app requests write_script_tags but never uses script tags.'),
      agentFinding('shopify.app.toml', 2, lines, 'The app requests read_orders but never reads orders.'),
    ])

    expect(planSuppression(targetOf(document, 1), decision, resultsOf(document), [])).toMatchObject({
      status: 'change',
      change: {type: 'add', entry: {path: 'shopify.app.toml', code: 'read_orders'}},
    })
  })

  test('refuses a finding that no code can name alone, with the findings that an entry without code suppresses', () => {
    const document = agentDocument('CREDENTIAL_LOG_LEAKAGE', [
      agentFinding('app/routes/orders.tsx', 3, routeLines.slice(0, 5), 'The access token reaches a log.'),
      agentFinding('app/routes/orders.tsx', 3, routeLines.slice(0, 5), 'The access token reaches a log.'),
      // A finding in another file, which an entry for app/routes/orders.tsx doesn't suppress.
      agentFinding('app/routes/billing.tsx', 3, routeLines.slice(0, 5), 'The access token reaches a log.'),
    ])

    expect(planSuppression(targetOf(document, 0), decision, resultsOf(document), [])).toStrictEqual({
      status: 'refused',
      problem:
        'every automatic code candidate also names another finding of CREDENTIAL_LOG_LEAKAGE in app/routes/orders.tsx',
      withoutCode: {findingCount: 2},
    })
  })

  test('counts every finding of the file for a finding without a line that no code can name alone', () => {
    const fileLevel = {location: {file: 'app/db.server.ts'}, message: 'The query has no shop filter.', evidence: []}
    const document = agentDocument('MISSING_TENANT_ISOLATION', [fileLevel, fileLevel, fileLevel])

    expect(planSuppression(targetOf(document, 0), decision, resultsOf(document), [])).toStrictEqual({
      status: 'refused',
      problem:
        'it has no line, so its entry would cover every finding of MISSING_TENANT_ISOLATION in app/db.server.ts, and there are several',
      withoutCode: {findingCount: 3},
    })
  })

  const evidenceAt = (line: number, text: string) => ({
    location: {file: 'app/routes/orders.tsx', line},
    code_excerpt: [{line, text}],
  })
  test.each([
    [
      'a short property segment in its code and message',
      [
        agentFinding('app/routes/orders.tsx', 1, ['console.log(db.id)'], 'id leaks'),
        {
          ...agentFinding('app/routes/orders.tsx', 1, ['console.log(db.id)'], 'logging unsafe'),
          evidence: [evidenceAt(2, '// id leaks')],
        },
      ],
      'id',
    ],
    [
      'a line of its evidence',
      [
        {...agentFinding('app/routes/orders.tsx', 3, routeLines, 'm'), evidence: [evidenceAt(8, 'logger.info(')]},
        {...agentFinding('app/routes/orders.tsx', 3, routeLines, 'm'), evidence: [evidenceAt(11, 'return null')]},
      ],
      'logger.info(',
    ],
  ])('reports the broader option without ruling out a manual selector from %s', (_name, findings, code) => {
    const document = agentDocument('CREDENTIAL_LOG_LEAKAGE', findings)

    const plan = planSuppression(targetOf(document, 0), decision, resultsOf(document), [])
    // A person can write an entry with that code by hand, and it suppresses the finding alone.
    const {checks, suppressions} = combineFindings({
      deterministic: null,
      agent: document,
      suppressions: {
        entries: [
          {
            source: 'agent',
            check: 'CREDENTIAL_LOG_LEAKAGE',
            kind: 'false-positive',
            path: 'app/routes/orders.tsx',
            code,
            reason: 'The logger redacts tokens.',
          },
        ],
      },
    })

    expect(plan).toStrictEqual({
      status: 'refused',
      problem:
        'every automatic code candidate also names another finding of CREDENTIAL_LOG_LEAKAGE in app/routes/orders.tsx',
      withoutCode: {findingCount: 2},
    })
    expect(suppressions[0]).toMatchObject({status: 'matched', matched_finding_count: 1})
    expect(checks[0]!.findings.filter(({disposition}) => disposition === 'suppressed')).toMatchObject([
      {message: findings[0]!.message, evidence: findings[0]!.evidence},
    ])
  })

  test('refuses a finding with a line but no captured code, and writes no code for a finding without a line', () => {
    const [withoutExcerpt] = agentDocument('CREDENTIAL_LOG_LEAKAGE', [
      {location: {file: 'app/routes/orders.tsx', line: 3}, message: 'm', evidence: []},
    ]).checks
    const document = agentDocument('CREDENTIAL_LOG_LEAKAGE', withoutExcerpt!.findings)

    expect(planSuppression(targetOf(document, 0), decision, resultsOf(document), [])).toStrictEqual({
      status: 'refused',
      problem: 'the results hold no code for its line, so no automatic code selector is available',
      withoutCode: {findingCount: 1},
    })

    const fileLevel = agentDocument('MISSING_TENANT_ISOLATION', [
      {location: {file: 'app/db.server.ts'}, message: 'm', evidence: []},
    ])
    expect(planSuppression(targetOf(fileLevel, 0), decision, resultsOf(fileLevel), [])).toMatchObject({
      status: 'change',
      change: {type: 'add', entry: {path: 'app/db.server.ts'}},
    })
    const plan = planSuppression(targetOf(fileLevel, 0), decision, resultsOf(fileLevel), [])
    expect(plan.status === 'change' && plan.change.type === 'add' && 'code' in plan.change.entry).toBe(false)
  })

  test('normalizes the path that the finding records, and refuses one that an entry cannot name', () => {
    const lines = routeLines.slice(0, 5)
    const document = agentDocument('CREDENTIAL_LOG_LEAKAGE', [
      agentFinding('./app/routes/orders.tsx', 3, lines, 'm'),
      agentFinding('app/routes/*.tsx', 3, lines, 'm'),
    ])

    expect(planSuppression(targetOf(document, 0), decision, resultsOf(document), [])).toMatchObject({
      status: 'change',
      change: {entry: {path: 'app/routes/orders.tsx'}},
    })
    expect(planSuppression(targetOf(document, 1), decision, resultsOf(document), [])).toStrictEqual({
      status: 'refused',
      problem: "its entry would be invalid: path: can't contain wildcards: name one file",
      invalidFields: ['path'],
    })
  })

  test.each([
    [
      'a check ID that this CLI does not know',
      'CREDENTIAL_LOGGING',
      'check: not a check ID that this version of Shopify CLI knows. Check the spelling, or upgrade Shopify CLI',
    ],
    [
      'a check that only the other source reports',
      'MISSING_DEPENDENCY_SECURITY_AUTOMATION',
      'check: agent checks in this version of Shopify CLI don\'t report MISSING_DEPENDENCY_SECURITY_AUTOMATION. Use "source": "deterministic", or upgrade Shopify CLI',
    ],
  ])(
    'refuses a finding of %s, as results from another CLI version hold, and names the check field',
    (_name, checkId, problem) => {
      const document = agentDocument(checkId, [agentFinding('app/routes/orders.tsx', 3, routeLines.slice(0, 5), 'm')])

      expect(planSuppression(targetOf(document, 0), decision, resultsOf(document), [])).toStrictEqual({
        status: 'refused',
        problem: `its entry would be invalid: ${problem}`,
        invalidFields: ['check'],
      })
    },
  )

  test('names each invalid field once, in the order of the problems', () => {
    const document = agentDocument('CREDENTIAL_LOGGING', [
      agentFinding('app/routes/*.tsx', 3, routeLines.slice(0, 5), 'm'),
    ])
    // A reason of only spaces, longer than the limit, has two problems.
    const blankReason = {kind: 'false-positive', reason: ' '.repeat(4_001)} as const

    expect(planSuppression(targetOf(document, 0), blankReason, resultsOf(document), [])).toStrictEqual({
      status: 'refused',
      problem:
        "its entry would be invalid: path: can't contain wildcards: name one file; reason: must be at most 4000 characters; reason: must not be empty; check: not a check ID that this version of Shopify CLI knows. Check the spelling, or upgrade Shopify CLI",
      invalidFields: ['path', 'reason', 'check'],
    })
  })

  test('leaves the file as it is when an entry already suppresses the finding under these results', () => {
    const document = agentDocument('CREDENTIAL_LOG_LEAKAGE', [
      agentFinding('app/routes/orders.tsx', 3, routeLines.slice(0, 5), 'm'),
    ])
    const pathEntry: AppSecuritySuppression = {
      source: 'agent',
      check: 'CREDENTIAL_LOG_LEAKAGE',
      kind: 'accepted-risk',
      path: 'app/routes/orders.tsx',
      reason: 'Local development only.',
    }

    expect(
      planSuppression(targetOf(document, 0), decision, resultsOf(document), [agentEntry, pathEntry]),
    ).toStrictEqual({status: 'saved', entryIndex: 1})
  })

  test('reuses an existing code selector without changing the suppression', () => {
    const document = agentDocument('CREDENTIAL_LOG_LEAKAGE', [
      agentFinding('app/routes/orders.tsx', 3, routeLines.slice(0, 5), 'm'),
    ])
    const stagingEntry: AppSecuritySuppression = {
      source: 'agent',
      check: 'CREDENTIAL_LOG_LEAKAGE',
      kind: 'accepted-risk',
      path: 'app/routes/orders.tsx',
      code: 'console.log(session.accessToken)',
      reason: 'Local development only.',
    }

    expect(
      planSuppression(targetOf(document, 0), decision, resultsOf(document), [agentEntry, stagingEntry]),
    ).toStrictEqual({
      status: 'saved',
      entryIndex: 1,
    })
  })

  test('plans a deterministic entry for a finding that a prefer-agent result supersedes, which check then leaves out', () => {
    // A stored finding has the same shape in both sources.
    const finding = agentFinding(
      'app/routes/orders.tsx',
      3,
      routeLines.slice(0, 5),
      'accessToken flows into console.log.',
    )
    const deterministic: DeterministicFindingsDocument = {
      ...deterministicFindingsDocument,
      checks: [
        {
          id: 'CREDENTIAL_LOG_LEAKAGE',
          version: 1,
          status: 'executed',
          snapshot: {title: 'CREDENTIAL_LOG_LEAKAGE', severity: 'high', description: '', current_version: 1},
          findings: [finding],
        },
      ],
    }
    // A newer prefer-agent result with no finding in the file, so no agent finding has the deterministic one as a companion.
    const [agentCheck] = agentDocument('CREDENTIAL_LOG_LEAKAGE', []).checks
    const agent: AgentFindingsDocument = {
      ...agentDocument('CREDENTIAL_LOG_LEAKAGE', []),
      checks: [{...agentCheck!, snapshot: {...agentCheck!.snapshot, precedence: 'prefer-agent'}}],
    }
    const target: SuppressionTarget = {
      source: 'deterministic',
      checkId: 'CREDENTIAL_LOG_LEAKAGE',
      findingIndex: 0,
      finding,
    }

    const plan = planSuppression(target, decision, {deterministic, agent}, [])

    expect(plan).toMatchObject({
      status: 'change',
      change: {type: 'add', entry: {source: 'deterministic', code: 'console.log(session.accessToken)'}},
    })
    const entry = plan.status === 'change' && plan.change.type === 'add' ? plan.change.entry : undefined
    const suppressions = {entries: [entry!]}
    // `review` combines both results: the finding stays superseded, and the entry matched it.
    const reviewed = combineFindings({deterministic, agent, suppressions})
    // `check` reads the deterministic results alone: the entry suppresses the finding.
    const checked = combineFindings({deterministic, agent: null, suppressions})
    expect(reviewed.checks[0]!.findings).toMatchObject([
      {disposition: 'superseded', suppressed_by: {origin: 'file', entry_index: 0}},
    ])
    expect(checked.checks[0]!.findings).toMatchObject([
      {disposition: 'suppressed', suppressed_by: {origin: 'file', entry_index: 0}},
    ])
    for (const {suppressions: results} of [reviewed, checked]) {
      expect(results[0]).toMatchObject({status: 'matched', matched_finding_count: 1})
    }
  })

  test('keeps matching the entry after unrelated edits move the line', () => {
    const document = agentDocument('CREDENTIAL_LOG_LEAKAGE', [
      agentFinding('app/routes/orders.tsx', 3, routeLines, 'The access token reaches a log.'),
    ])
    const plan = planSuppression(targetOf(document, 0), decision, resultsOf(document), [])
    const entry = plan.status === 'change' && plan.change.type === 'add' ? plan.change.entry : undefined
    const movedLines = ['import {logger} from "./logger"', '', ...routeLines]
    const moved = agentDocument('CREDENTIAL_LOG_LEAKAGE', [
      agentFinding('app/routes/orders.tsx', 5, movedLines, 'The access token reaches a log.'),
    ])

    const {checks, suppressions} = combineFindings({
      deterministic: null,
      agent: moved,
      suppressions: {entries: [entry!]},
    })

    expect(suppressions[0]).toMatchObject({status: 'matched', matched_finding_count: 1})
    expect(checks[0]!.findings[0]).toMatchObject({location: {line: 5}, disposition: 'suppressed'})
  })
})

describe('saveAppSecuritySuppressions', () => {
  const newEntry: AppSecuritySuppression = {
    source: 'deterministic',
    check: 'EOL_API_VERSION',
    kind: 'accepted-risk',
    path: 'shopify.app.toml',
    code: 'api_version = "2024-01"',
    reason: 'The upgrade ships with the next release.',
  }

  test('creates the file with schema_version 1, as two-space JSON with a trailing newline, outside .shopify', async () => {
    await inTemporaryDirectory(async (directory) => {
      const saved = await saveAppSecuritySuppressions(directory, [{type: 'add', entry: newEntry}], [])

      const path = appSecuritySuppressionsPath(directory)
      expect(saved).toStrictEqual({path, saved: [{index: 0, change: 'added', entry: newEntry}]})
      await expect(readFile(path)).resolves.toBe(
        `${JSON.stringify({schema_version: 1, suppressions: [newEntry]}, null, 2)}\n`,
      )
      await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([newEntry])
      await expect(fileExists(joinPath(directory, '.shopify'))).resolves.toBe(false)
      // The write is atomic: no temporary file is left.
      await expect(readdir(directory)).resolves.toStrictEqual(['shopify.app-security.json'])
    })
  })

  test('appends entries, keeping every other entry and key as the file has them', async () => {
    await inTemporaryDirectory(async (directory) => {
      // The file can't hold unknown keys, so `$schema` and an entry with its keys in another order stand for them.
      const original = {
        $schema: './shopify.app-security.schema.json',
        schema_version: 1,
        suppressions: [Object.fromEntries(Object.entries(deterministicEntry).reverse()), agentEntry],
      }
      const originalText = `${JSON.stringify(original, null, 2)}\n`
      await writeSuppressionsFile(directory, originalText)

      const {saved} = await saveAppSecuritySuppressions(
        directory,
        [{type: 'add', entry: newEntry}],
        [deterministicEntry, agentEntry],
      )

      const text = await readFile(appSecuritySuppressionsPath(directory))
      const expected = {
        ...original,
        suppressions: [
          {
            ...original.suppressions[0],
          },
          agentEntry,
          newEntry,
        ],
      }
      expect(text).toBe(`${JSON.stringify(expected, null, 2)}\n`)
      // The untouched entry is the same text, byte for byte.
      expect(text).toContain(JSON.stringify(agentEntry, null, 2).replaceAll('\n', '\n    '))
      expect(saved).toStrictEqual([{index: 2, change: 'added', entry: newEntry}])
    })
  })

  test('refuses to write into an invalid file, and leaves it as it is', async () => {
    await inTemporaryDirectory(async (directory) => {
      const invalid = suppressionsJson([{...deterministicEntry, kind: 'wont_fix'}])
      await writeSuppressionsFile(directory, invalid)

      const error: unknown = await saveAppSecuritySuppressions(directory, [{type: 'add', entry: newEntry}], []).catch(
        (error: unknown) => error,
      )

      expect(error).toBeInstanceOf(AbortError)
      expect((error as AbortError).code).toBe('suppressions-file-invalid')
      expect((error as AbortError).details).toMatchObject({
        errors: ['suppressions[0].kind: must be false-positive or accepted-risk'],
      })
      await expect(readFile(appSecuritySuppressionsPath(directory))).resolves.toBe(invalid)
    })
  })

  test.skipIf(process.platform === 'win32')('keeps the permissions of an existing file', async () => {
    await inTemporaryDirectory(async (directory) => {
      const path = await writeSuppressionsFile(directory, suppressionsJson([]))
      await chmod(path, 0o640)

      await saveAppSecuritySuppressions(directory, [{type: 'add', entry: newEntry}], [])

      expect((await stat(path)).mode & 0o777).toBe(0o640)
    })
  })

  test.each(['reorder', 'delete'] as const)(
    'refuses changed entries after %s without changing the file',
    async (change) => {
      await inTemporaryDirectory(async (directory) => {
        const expected = [deterministicEntry, agentEntry]
        const changed = change === 'reorder' ? [...expected].reverse() : [agentEntry]
        const text = suppressionsJson(changed)
        await writeSuppressionsFile(directory, text)

        await expect(
          saveAppSecuritySuppressions(directory, [{type: 'add', entry: newEntry}], expected),
        ).rejects.toMatchObject({code: 'suppressions-file-changed'})

        await expect(readFile(appSecuritySuppressionsPath(directory))).resolves.toBe(text)
        await expect(readdir(directory)).resolves.toStrictEqual(['shopify.app-security.json'])
      })
    },
  )

  test('validates new entries before the other artifact is written', async () => {
    await inTemporaryDirectory(async (directory) => {
      let called = false
      await expect(
        saveAppSecuritySuppressions(directory, [{type: 'add', entry: {...newEntry, reason: ''}}], [], async () => {
          called = true
        }),
      ).rejects.toMatchObject({code: 'suppressions-file-invalid'})
      expect(called).toBe(false)
      await expect(readdir(directory)).resolves.toStrictEqual([])
    })
  })

  test('releases the lock and preserves the file if the other artifact write fails', async () => {
    await inTemporaryDirectory(async (directory) => {
      const original = suppressionsJson([])
      await writeSuppressionsFile(directory, original)
      const error = new Error('The other artifact could not be written')
      await expect(
        saveAppSecuritySuppressions(directory, [{type: 'add', entry: newEntry}], [], async () => {
          throw error
        }),
      ).rejects.toBe(error)
      await expect(readFile(appSecuritySuppressionsPath(directory))).resolves.toBe(original)
      await expect(readdir(directory)).resolves.toStrictEqual(['shopify.app-security.json'])
      await saveAppSecuritySuppressions(directory, [{type: 'add', entry: newEntry}], [])
      await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([newEntry])
    })
  })

  test('refuses an external edit during preparation and keeps its content', async () => {
    await inTemporaryDirectory(async (directory) => {
      const edited = suppressionsJson([agentEntry])
      await expect(
        saveAppSecuritySuppressions(directory, [{type: 'add', entry: newEntry}], [], async () => {
          await writeSuppressionsFile(directory, edited)
        }),
      ).rejects.toMatchObject({code: 'suppressions-file-changed'})
      await expect(readFile(appSecuritySuppressionsPath(directory))).resolves.toBe(edited)
      await expect(readdir(directory)).resolves.toStrictEqual(['shopify.app-security.json'])
    })
  })

  test('does not let a concurrent writer overwrite the prepared save', async () => {
    await inTemporaryDirectory(async (directory) => {
      let signalPrepared!: () => void
      const prepared = new Promise<void>((resolve) => {
        signalPrepared = resolve
      })
      let resume!: () => void
      const continueSave = new Promise<void>((resolve) => {
        resume = resolve
      })
      const first = saveAppSecuritySuppressions(directory, [{type: 'add', entry: newEntry}], [], async () => {
        signalPrepared()
        await continueSave
      })
      // Observe failures while the other save is in progress.
      const firstResult = first.catch((error: unknown) => error)
      try {
        await prepared
        await expect(
          saveAppSecuritySuppressions(directory, [{type: 'add', entry: agentEntry}], []),
        ).rejects.toMatchObject({code: 'ELOCKED'})
      } finally {
        resume()
      }
      await expect(firstResult).resolves.toMatchObject({saved: [{entry: newEntry}]})
      await expect(readAppSecuritySuppressions(directory)).resolves.toStrictEqual([newEntry])
      await expect(readdir(directory)).resolves.toStrictEqual(['shopify.app-security.json'])
    })
  })
})
