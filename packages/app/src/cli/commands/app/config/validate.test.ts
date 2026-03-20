import Validate from './validate.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {validateApp} from '../../../services/validate.js'
import {testAppLinked} from '../../../models/app/app.test-data.js'
import {describe, expect, test, vi} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'

vi.mock('../../../services/app-context.js')
vi.mock('../../../services/validate.js')
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {
    ...actual,
    outputResult: vi.fn(),
  }
})

describe('app config validate command', () => {
  test('calls validateApp with json: false by default', async () => {
    // Given
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    // When
    await Validate.run([], import.meta.url)

    // Then
    expect(validateApp).toHaveBeenCalledWith(app, {json: false})
  })

  test('calls validateApp with json: true when --json flag is passed', async () => {
    // Given
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    // When
    await Validate.run(['--json'], import.meta.url)

    // Then
    expect(validateApp).toHaveBeenCalledWith(app, {json: true})
  })

  test('calls validateApp with json: true when -j flag is passed', async () => {
    // Given
    const app = testAppLinked()
    vi.mocked(linkedAppContext).mockResolvedValue({app} as Awaited<ReturnType<typeof linkedAppContext>>)
    vi.mocked(validateApp).mockResolvedValue()

    // When
    await Validate.run(['-j'], import.meta.url)

    // Then
    expect(validateApp).toHaveBeenCalledWith(app, {json: true})
  })

  test('outputs json issues when app loading aborts before validateApp runs', async () => {
    // Given
    vi.mocked(linkedAppContext).mockRejectedValue(
      new AbortError('Validation errors in /tmp/shopify.app.toml:\n\n• [name]: String is required'),
    )

    // When / Then
    await Validate.run(['--json', '--path=/tmp/app'], import.meta.url).catch(() => {})
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: '/tmp/shopify.app.toml',
              path: [],
              pathString: 'name',
              message: 'String is required',
            },
          ],
        },
        null,
        2,
      ),
    )
    expect(validateApp).not.toHaveBeenCalled()
  })

  test('outputs json issues when app loading aborts with ansi-colored structured text', async () => {
    // Given
    vi.mocked(linkedAppContext).mockRejectedValue(
      new AbortError(
        '\u001b[1m\u001b[91mValidation errors\u001b[39m\u001b[22m in /tmp/shopify.app.toml:\n\n• [name]: String is required',
      ),
    )

    // When / Then
    await Validate.run(['--json', '--path=/tmp/app'], import.meta.url).catch(() => {})
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: '/tmp/shopify.app.toml',
              path: [],
              pathString: 'name',
              message: 'String is required',
            },
          ],
        },
        null,
        2,
      ),
    )
    expect(validateApp).not.toHaveBeenCalled()
  })

  test('preserves a root json issue when contextual text precedes structured validation errors', async () => {
    // Given
    vi.mocked(linkedAppContext).mockRejectedValue(
      new AbortError(
        'Could not infer extension handle\n\nValidation errors in /tmp/shopify.app.toml:\n\n• [name]: String is required',
      ),
    )

    // When / Then
    await Validate.run(['--json', '--path=/tmp/app'], import.meta.url).catch(() => {})
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: '/tmp/shopify.app.toml',
              path: [],
              pathString: 'name',
              message: 'String is required',
            },
            {
              filePath: '/tmp/shopify.app.toml',
              path: [],
              pathString: 'root',
              message:
                'Could not infer extension handle\n\nValidation errors in /tmp/shopify.app.toml:\n\n• [name]: String is required',
            },
          ],
        },
        null,
        2,
      ),
    )
    expect(validateApp).not.toHaveBeenCalled()
  })

  test('parses structured validation errors for windows-style paths', async () => {
    // Given
    vi.mocked(linkedAppContext).mockRejectedValue(
      new AbortError('Validation errors in C:\\tmp\\shopify.app.toml:\n\n• [name]: String is required'),
    )

    // When / Then
    await Validate.run(['--json', '--path=/tmp/app'], import.meta.url).catch(() => {})
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: 'C:\\tmp\\shopify.app.toml',
              path: [],
              pathString: 'name',
              message: 'String is required',
            },
          ],
        },
        null,
        2,
      ),
    )
    expect(validateApp).not.toHaveBeenCalled()
  })

  test('outputs a root json issue when app loading aborts with a non-structured message', async () => {
    // Given
    vi.mocked(linkedAppContext).mockRejectedValue(new AbortError("Couldn't find an app toml file at /tmp/app"))

    // When / Then
    await Validate.run(['--json', '--path=/tmp/app'], import.meta.url).catch(() => {})
    expect(outputResult).toHaveBeenCalledWith(
      JSON.stringify(
        {
          valid: false,
          issues: [
            {
              filePath: '/tmp/app',
              path: [],
              pathString: 'root',
              message: "Couldn't find an app toml file at /tmp/app",
            },
          ],
        },
        null,
        2,
      ),
    )
    expect(validateApp).not.toHaveBeenCalled()
  })

  test('rethrows unrelated abort errors in json mode without converting them to validation json', async () => {
    // Given
    vi.mocked(linkedAppContext).mockRejectedValue(new AbortError('Could not find store for domain shop.example.com'))

    // When / Then
    await expect(Validate.run(['--json', '--path=/tmp/app'], import.meta.url)).rejects.toThrow()
    expect(outputResult).not.toHaveBeenCalled()
    expect(validateApp).not.toHaveBeenCalled()
  })
})
