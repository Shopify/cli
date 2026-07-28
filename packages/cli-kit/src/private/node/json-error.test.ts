import {fatalErrorToJsonDocument, renderFatalErrorAsJson} from './json-error.js'
import {consoleLog, output} from './output.js'
import {
  AbortError,
  AbortSilentError,
  BugError,
  ExternalError,
  FatalErrorType,
  resolveJsonErrorType,
} from '../../public/node/error.js'
import {mockAndCaptureOutput} from '../../public/node/testing/output.js'
import {joinPath, moduleDirectory} from '../../public/node/path.js'
import {describe, expect, test, vi} from 'vitest'
import {transform} from 'esbuild'
import {readFile} from 'fs/promises'
import type {JsonErrorType} from '../../public/node/error.js'

// Spies on the private `output` while keeping its real behaviour, which is what lets the
// stream-routing test below tell `outputResult` from `outputInfo`. The public `output.js` is
// deliberately left alone: it exports `collectedLogs` as a mutable binding, and spreading it
// into a mock would snapshot it, breaking `mockAndCaptureOutput` for every other test here.
vi.mock('./output.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./output.js')>()
  return {...actual, output: vi.fn(actual.output)}
})

describe('the type discriminator', () => {
  test('gives each error class a distinct, stable string', () => {
    expect(fatalErrorToJsonDocument(new AbortError('boom'))?.error.type).toBe('abort')
    expect(fatalErrorToJsonDocument(new BugError('boom'))?.error.type).toBe('bug')
    expect(fatalErrorToJsonDocument(new ExternalError('boom', 'npm', ['install']))?.error.type).toBe('external')
  })

  test('distinguishes AbortError from ExternalError even though both carry FatalErrorType.Abort', () => {
    // Given
    const abort = new AbortError('boom')
    const external = new ExternalError('boom', 'npm', ['install'])

    // Then
    expect(abort.type).toBe(external.type)
    expect(fatalErrorToJsonDocument(abort)?.error.type).not.toBe(fatalErrorToJsonDocument(external)?.error.type)
  })

  test('resolves every FatalErrorType member to its expected discriminator', () => {
    // Given
    // Spelled out rather than derived from `jsonErrorTypeForFatalErrorType`: deriving the
    // expectation from the map under test would pass no matter what the map said.
    const expectedForMember: Record<FatalErrorType, JsonErrorType> = {
      [FatalErrorType.Abort]: 'abort',
      [FatalErrorType.AbortSilent]: 'abortSilent',
      [FatalErrorType.Bug]: 'bug',
    }
    const numericMembers = Object.values(FatalErrorType).filter((member): member is FatalErrorType => {
      return typeof member === 'number'
    })

    // Then
    expect(numericMembers.length).toBeGreaterThan(0)
    numericMembers.forEach((member) => {
      // Fails loudly if a member is added to the enum without an expectation here, rather
      // than silently checking nothing for it.
      expect(expectedForMember[member]).toBeDefined()
      expect(resolveJsonErrorType({type: member})).toBe(expectedForMember[member])
    })
  })

  test('pins the enum values, which are a wire format shared across cli-kit copies', () => {
    // `resolveJsonErrorType` reads this number off errors built by a possibly different copy
    // of cli-kit, so reordering or renumbering a member silently changes what it means.
    expect(FatalErrorType.Abort).toBe(0)
    expect(FatalErrorType.AbortSilent).toBe(1)
    expect(FatalErrorType.Bug).toBe(2)
  })

  test('falls back to the numeric type when jsonErrorType is missing, as for an error from another cli-kit copy', () => {
    expect(resolveJsonErrorType({type: FatalErrorType.Abort})).toBe('abort')
    expect(resolveJsonErrorType({type: FatalErrorType.Bug})).toBe('bug')
    expect(resolveJsonErrorType({type: FatalErrorType.AbortSilent})).toBe('abortSilent')
  })

  test('reports an unrecognised numeric type as a bug rather than mislabelling it', () => {
    // A member added by a newer cli-kit than the one resolving it.
    expect(resolveJsonErrorType({type: 999 as FatalErrorType})).toBe('bug')
    expect(resolveJsonErrorType({})).toBe('bug')
  })

  test('prefers an explicit jsonErrorType over the numeric type', () => {
    expect(resolveJsonErrorType({type: FatalErrorType.Abort, jsonErrorType: 'external'})).toBe('external')
  })

  test('ignores an unknown explicit jsonErrorType from a newer cli-kit and falls back', () => {
    // `jsonErrorType` is a writable public field and its type is erased at runtime, so a
    // newer copy of cli-kit can set a discriminator this version does not advertise. Passing
    // it through would put a value on the wire that consumers' exhaustive switches cannot
    // handle, so it is ignored in favour of the numeric type.
    const fromNewerCliKit = {jsonErrorType: 'new-type'} as unknown as {jsonErrorType: JsonErrorType}

    // Then
    expect(resolveJsonErrorType({...fromNewerCliKit, type: FatalErrorType.Abort})).toBe('abort')
    expect(resolveJsonErrorType({...fromNewerCliKit, type: FatalErrorType.Bug})).toBe('bug')
    expect(resolveJsonErrorType(fromNewerCliKit)).toBe('bug')
  })

  test('never emits an unknown discriminator in a document', () => {
    // Given
    const error = {message: 'boom', type: FatalErrorType.Abort, jsonErrorType: 'new-type'} as unknown as Parameters<
      typeof fatalErrorToJsonDocument
    >[0]

    // When
    const document = fatalErrorToJsonDocument(error)

    // Then
    expect(JSON.stringify(document)).not.toContain('new-type')
    expect(document?.error.type).toBe('abort')
  })
})

describe('flattening', () => {
  test('flattens a TokenItem tryMessage to a plain string', () => {
    // Given
    const error = new AbortError('boom', ['Run', {command: 'shopify app dev'}, 'again'])

    // Then
    expect(fatalErrorToJsonDocument(error)?.error.tryMessage).toBe('Run shopify app dev again')
  })

  test('flattens nextSteps to an array of strings', () => {
    // Given
    const error = new AbortError('boom', null, [
      ['Visit', {link: {label: 'the docs', url: 'https://shopify.dev'}}],
      'Try again',
    ])

    // Then
    expect(fatalErrorToJsonDocument(error)?.error.nextSteps).toStrictEqual(['Visit the docs', 'Try again'])
  })

  test('flattens a token customSection body to a string and a tabularData body to a string matrix', () => {
    // Given
    const error = new AbortError('boom', null, undefined, [
      {title: 'Notes', body: ['See', {command: 'shopify help'}]},
      {
        title: 'Extensions',
        body: {
          tabularData: [
            ['name', 'status'],
            ['my-ext', {subdued: 'failed'}],
          ],
        },
      },
    ])

    // When
    const sections = fatalErrorToJsonDocument(error)?.error.customSections

    // Then
    expect(sections).toStrictEqual([
      {title: 'Notes', body: 'See shopify help'},
      {
        title: 'Extensions',
        body: [
          ['name', 'status'],
          ['my-ext', 'failed'],
        ],
      },
    ])
  })

  test('omits the title of an untitled custom section', () => {
    // Given
    const error = new AbortError('boom', null, undefined, [{body: 'just a body'}])

    // Then
    expect(fatalErrorToJsonDocument(error)?.error.customSections).toStrictEqual([{body: 'just a body'}])
  })

  test('strips ANSI escape codes from every string it emits', () => {
    // Given
    const red = (text: string) => `\u001b[31m${text}\u001b[39m`
    const error = new AbortError(
      red('boom'),
      red('try this'),
      [red('a step')],
      [{title: 'Notes', body: red('a note')}, {body: {tabularData: [[red('cell')]]}}],
    )

    // When
    const payload = fatalErrorToJsonDocument(error)?.error

    // Then
    const serialized = JSON.stringify(payload)
    expect(serialized).not.toContain('\u001b')
    expect(payload?.message).toBe('boom')
    expect(payload?.tryMessage).toBe('try this')
    expect(payload?.nextSteps).toStrictEqual(['a step'])
    expect(payload?.customSections).toStrictEqual([{title: 'Notes', body: 'a note'}, {body: [['cell']]}])
  })
})

describe('field presence', () => {
  test('omits absent optional fields rather than emitting nulls', () => {
    // When
    const payload = fatalErrorToJsonDocument(new AbortError('boom'))?.error

    // Then
    expect(payload).toStrictEqual({type: 'abort', message: 'boom'})
  })

  test('omits an empty nextSteps array rather than emitting []', () => {
    // Given
    const error = new AbortError('boom', null, [])

    // When
    const payload = fatalErrorToJsonDocument(error)?.error

    // Then
    expect(payload).not.toHaveProperty('nextSteps')
    expect(payload).toStrictEqual({type: 'abort', message: 'boom'})
  })

  test('omits an empty customSections array rather than emitting []', () => {
    // Given
    const error = new AbortError('boom', null, undefined, [])

    // When
    const payload = fatalErrorToJsonDocument(error)?.error

    // Then
    expect(payload).not.toHaveProperty('customSections')
    expect(payload).toStrictEqual({type: 'abort', message: 'boom'})
  })

  test('includes command and args for an ExternalError', () => {
    // When
    const payload = fatalErrorToJsonDocument(new ExternalError('boom', 'npm', ['install', '--save']))?.error

    // Then
    expect(payload?.command).toBe('npm')
    expect(payload?.args).toStrictEqual(['install', '--save'])
    // `stack` is gated on the bug type, and `ExternalError` shares `FatalErrorType.Abort`
    // with `AbortError`, so it must not leak a trace either.
    expect(payload?.stack).toBeUndefined()
  })

  test('includes the stack for a bug, since that is the type users are asked to report', () => {
    // When
    const payload = fatalErrorToJsonDocument(new BugError('boom'))?.error

    // Then
    expect(payload?.stack).toContain('boom')
  })

  test('omits the stack for an abort', () => {
    // Given
    const error = new AbortError('boom')

    // Then
    expect(error.stack).toBeDefined()
    expect(fatalErrorToJsonDocument(error)?.error.stack).toBeUndefined()
  })

  test('does not emit an exit code, because the mapped error does not carry oclif.exit', () => {
    // When
    const payload = fatalErrorToJsonDocument(new AbortError('boom'))?.error

    // Then
    expect(payload).not.toHaveProperty('exitCode')
  })
})

describe('intentionally silent errors', () => {
  test('emits no document for an AbortSilentError', () => {
    expect(fatalErrorToJsonDocument(new AbortSilentError())).toBeUndefined()
  })

  test('emits no document for an AbortSilent type that arrived without a jsonErrorType', () => {
    // An error built by a duplicate copy of cli-kit, where errorHandler's `instanceof` check
    // does not hold and it reaches the serializer.
    expect(fatalErrorToJsonDocument({type: FatalErrorType.AbortSilent, message: ''})).toBeUndefined()
  })

  test('writes nothing at all when the error is silent', () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    renderFatalErrorAsJson(new AbortSilentError())

    // Then
    expect(outputMock.output()).toBe('')
  })
})

describe('renderFatalErrorAsJson', () => {
  test('writes a single JSON.parse-able document', () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    renderFatalErrorAsJson(new AbortError('boom', 'try this'))

    // Then
    const written = outputMock.info()
    expect(() => JSON.parse(written)).not.toThrow()
    expect(JSON.parse(written)).toStrictEqual({error: {type: 'abort', message: 'boom', tryMessage: 'try this'}})
  })

  test('nests the payload under a single error key so scripts can tell failure from success', () => {
    // Given
    const outputMock = mockAndCaptureOutput()
    outputMock.clear()

    // When
    renderFatalErrorAsJson(new AbortError('boom'))

    // Then
    expect(Object.keys(JSON.parse(outputMock.info()))).toStrictEqual(['error'])
  })

  test('writes through the stdout logger rather than the stderr one', () => {
    // The captured log cannot tell `outputResult` from `outputInfo`: both file their content
    // under `info` via `collectLog`. What separates them is the logger they delegate to.
    // `outputResult` calls the private `output()` with `consoleLog` (`process.stdout.write`),
    // while `outputInfo` uses `consoleWarn` (`process.stderr.write`) and never calls
    // `output()` at all, so asserting this call is what catches a switch between the two.
    // Caveat kept deliberately: `shouldOutput()` is false under `isUnitTest()`, so nothing
    // reaches a real stream here. This asserts the logger the write is handed to, which is
    // the closest a unit test can get to observing stream identity.
    // Given
    const error = new AbortError('boom')
    vi.mocked(output).mockClear()

    // When
    renderFatalErrorAsJson(error)

    // Then
    expect(output).toHaveBeenCalledWith(JSON.stringify(fatalErrorToJsonDocument(error)), 'info', consoleLog)
  })
})

describe('minification survival', () => {
  // The published npm bundle is built with `minifyIdentifiers: true`, which is why the
  // discriminator is a string literal rather than a class or enum name. vitest runs
  // unminified TypeScript, so this is the only test that can catch a regression to a
  // reflective name. A single-file transform keeps it fast and hermetic — no bundling.
  test('keeps every discriminator string verbatim under minifyIdentifiers', async () => {
    // Given
    const errorSourcePath = joinPath(moduleDirectory(import.meta.url), '..', '..', 'public', 'node', 'error.ts')
    const source = await readFile(errorSourcePath, 'utf8')

    // When
    const {code} = await transform(source, {loader: 'ts', minifyIdentifiers: true})

    // Then
    ;['abort', 'abortSilent', 'bug', 'external'].forEach((discriminator) => {
      expect(code).toContain(`"${discriminator}"`)
    })
  })
})
