import {renderFatalErrorAsJson} from './json-error.js'
import {AbortError, AbortSilentError, BugError, ExternalError, FatalErrorType} from '../../public/node/error.js'
import {mockAndCaptureOutput} from '../../public/node/testing/output.js'
import {afterEach, describe, expect, test} from 'vitest'

afterEach(() => {
  mockAndCaptureOutput().clear()
})

function renderedDocument(error: Parameters<typeof renderFatalErrorAsJson>[0]): unknown {
  const output = mockAndCaptureOutput()
  output.clear()
  renderFatalErrorAsJson(error)
  return JSON.parse(output.info())
}

describe('renderFatalErrorAsJson', () => {
  test.each([
    ['abort', new AbortError('Expected failure'), {type: 'abort', message: 'Expected failure'}],
    [
      'bug',
      new BugError('Unexpected failure'),
      {type: 'bug', message: 'Unexpected failure', stack: expect.any(String)},
    ],
    [
      'external',
      new ExternalError('External failure', 'npm', ['install']),
      {type: 'external', message: 'External failure', command: 'npm', args: ['install']},
    ],
  ])('renders a stable %s error', (_type, error, expectedError) => {
    expect(renderedDocument(error)).toStrictEqual({error: expectedError})
  })

  test('uses the rich message content and preserves link URLs', () => {
    const error = new AbortError([
      'Read',
      {link: {label: 'the documentation', url: 'https://shopify.dev'}},
      {char: '.'},
    ])

    expect(renderedDocument(error)).toStrictEqual({
      error: {type: 'abort', message: 'Read the documentation (https://shopify.dev).'},
    })
  })

  test('includes a plain try message', () => {
    expect(renderedDocument(new AbortError('Expected failure', 'Try again'))).toStrictEqual({
      error: {type: 'abort', message: 'Expected failure', tryMessage: 'Try again'},
    })
  })

  test('flattens rich try message tokens to an unstyled string', () => {
    const error = new AbortError('Expected failure', [
      '\u001B[31mRun\u001B[39m',
      {command: 'shopify app dev'},
      {char: '.'},
    ])

    expect(renderedDocument(error)).toStrictEqual({
      error: {type: 'abort', message: 'Expected failure', tryMessage: 'Run shopify app dev.'},
    })
  })

  test('includes next steps as unstyled strings with visible link URLs', () => {
    const error = new AbortError('Expected failure', null, [
      ['Read', {link: {label: 'the documentation', url: 'https://shopify.dev'}}, {char: '.'}],
      '\u001B[31mTry again.\u001B[39m',
    ])

    expect(renderedDocument(error)).toStrictEqual({
      error: {
        type: 'abort',
        message: 'Expected failure',
        nextSteps: ['Read the documentation (https://shopify.dev).', 'Try again.'],
      },
    })
  })

  test('includes custom text and tabular sections', () => {
    const error = new AbortError('Expected failure', null, undefined, [
      {
        title: '\u001B[31mExtension\u001B[39m',
        body: [
          {
            list: {
              title: 'Validation errors',
              items: ['Missing name', ['Read', {link: {label: 'the documentation', url: 'https://shopify.dev'}}]],
            },
          },
        ],
      },
      {
        body: {
          tabularData: [
            ['Name', {bold: 'Status'}],
            ['checkout', '\u001B[31mFailed\u001B[39m'],
          ],
        },
      },
    ])

    expect(renderedDocument(error)).toStrictEqual({
      error: {
        type: 'abort',
        message: 'Expected failure',
        customSections: [
          {
            title: 'Extension',
            body: 'Validation errors: Missing name; Read the documentation (https://shopify.dev)',
          },
          {
            body: [
              ['Name', 'Status'],
              ['checkout', 'Failed'],
            ],
          },
        ],
      },
    })
  })

  test('includes stacks only for bug errors', () => {
    const bug = new BugError('Unexpected failure')
    bug.stack = '\u001B[31mError: Unexpected failure\u001B[39m\n    at example.ts:1:1'
    const abort = new AbortError('Expected failure')
    abort.stack = 'Error: Expected failure\n    at example.ts:1:1'

    expect(renderedDocument(bug)).toStrictEqual({
      error: {
        type: 'bug',
        message: 'Unexpected failure',
        stack: 'Error: Unexpected failure\n    at example.ts:1:1',
      },
    })
    expect(renderedDocument(abort)).toStrictEqual({
      error: {type: 'abort', message: 'Expected failure'},
    })
  })

  test('omits empty optional collections', () => {
    expect(renderedDocument(new AbortError('Expected failure', null, [], []))).toStrictEqual({
      error: {type: 'abort', message: 'Expected failure'},
    })
  })

  test('omits malformed try messages without breaking the base error document', () => {
    const error = Object.assign(new AbortError('Expected failure'), {tryMessage: {invalid: true}})

    expect(renderedDocument(error)).toStrictEqual({
      error: {type: 'abort', message: 'Expected failure'},
    })
  })

  test('does not render intentionally silent errors', () => {
    const output = mockAndCaptureOutput()
    output.clear()

    renderFatalErrorAsJson(new AbortSilentError())

    expect(output.output()).toBe('')
  })

  test('includes external command context but not external stacks or arbitrary properties', () => {
    const error = Object.assign(new ExternalError('Safe message', 'npm', ['install']), {
      stack: 'external stack',
      accessToken: 'secret',
      request: {authorization: 'secret'},
    })

    expect(renderedDocument(error)).toStrictEqual({
      error: {type: 'external', message: 'Safe message', command: 'npm', args: ['install']},
    })
  })

  test('treats unknown fatal error types as bugs', () => {
    expect(renderedDocument({type: 999, message: 'Future error'})).toStrictEqual({
      error: {type: 'bug', message: 'Future error'},
    })
  })

  test('recognizes silent errors created by another cli-kit copy', () => {
    const output = mockAndCaptureOutput()
    output.clear()

    renderFatalErrorAsJson({type: FatalErrorType.AbortSilent, message: ''})

    expect(output.output()).toBe('')
  })
})
