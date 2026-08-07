import {computeThemeValidation, runThemeValidation} from './theme.js'
import {ValidationResult} from './engine/contract.js'
import {describe, expect, test, vi} from 'vitest'
import {inTemporaryDirectory, mkdir, writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

// Mock only cli-kit output/ui/metadata. The filesystem is never mocked — tests
// use real temp directories via inTemporaryDirectory.
vi.mock('@shopify/cli-kit/node/output', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/output')>()
  return {...actual, outputResult: vi.fn()}
})
vi.mock('@shopify/cli-kit/node/ui')
vi.mock('@shopify/cli-kit/node/metadata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shopify/cli-kit/node/metadata')>()
  return {...actual, addPublicMetadata: vi.fn()}
})

// A theme app extension app block: `target`, `javascript` and `stylesheet` are
// valid schema properties only in the "app" context, so the same code passes
// under --context app but fails under --context theme.
const APP_BLOCK = `<div {{ block.shopify_attributes }}>
  {{ app.metafields.reviews.rating.value }}
  {{ target.product.title }}
</div>

{% schema %}
{
  "name": "Rating stars",
  "target": "section",
  "javascript": "rating.js",
  "stylesheet": "rating.css",
  "settings": []
}
{% endschema %}`

// Builds a minimal on-disk theme. theme-check reads a `locales` directory to
// resolve default translations, so include an empty default locale file.
async function writeTheme(root: string, files: {[relativePath: string]: string}) {
  await mkdir(joinPath(root, 'locales'))
  await writeFile(joinPath(root, 'locales', 'en.default.json'), '{}')
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const absolutePath = joinPath(root, relativePath)
      await mkdir(absolutePath.split('/').slice(0, -1).join('/'))
      await writeFile(absolutePath, content)
    }),
  )
}

describe('computeThemeValidation - codeblock mode', () => {
  test('validates theme app extension app blocks under app context', async () => {
    const outcome = await computeThemeValidation({
      filename: 'rating.liquid',
      filetype: 'blocks',
      context: 'app',
      code: APP_BLOCK,
    })

    expect(outcome.success).toBe(true)
    expect(outcome.responses[0]?.result).not.toBe(ValidationResult.FAILED)
    expect(outcome.responses[0]?.resultDetail).not.toContain('Property target is not allowed')
  })

  test('pins the app-context app block to an INFORM result (warning, not error)', async () => {
    // In app context the app-block-only schema properties are allowed, so the
    // only finding is a WARNING (`UndefinedObject`) — a non-error finding, which
    // must surface as INFORM (a pass), never SUCCESS or FAILED.
    const outcome = await computeThemeValidation({
      filename: 'rating.liquid',
      filetype: 'blocks',
      context: 'app',
      code: APP_BLOCK,
    })

    expect(outcome.success).toBe(true)
    expect(outcome.responses[0]?.result).toBe(ValidationResult.INFORM)
  })

  test('keeps theme context schema failures for app-block-only properties', async () => {
    const outcome = await computeThemeValidation({
      filename: 'rating.liquid',
      filetype: 'blocks',
      context: 'theme',
      code: APP_BLOCK,
    })

    expect(outcome.success).toBe(false)
    expect(outcome.responses[0]?.result).toBe(ValidationResult.FAILED)
    expect(outcome.responses[0]?.resultDetail).toContain('Property target is not allowed')
  })

  test('validates doc tags in snippet context', async () => {
    const snippet = `{% doc %}
  @description Renders a product card.
{% enddoc %}
<div>{{ product.title }}</div>`

    const outcome = await computeThemeValidation({
      filename: 'product-card.liquid',
      filetype: 'snippets',
      code: snippet,
    })

    expect(outcome.success).toBe(true)
    expect(outcome.responses[0]?.result).toBe(ValidationResult.SUCCESS)
  })

  test('still fails invalid Liquid', async () => {
    const outcome = await computeThemeValidation({
      filename: 'broken.liquid',
      filetype: 'snippets',
      code: '{% if product %}',
    })

    expect(outcome.success).toBe(false)
    expect(outcome.responses[0]?.result).toBe(ValidationResult.FAILED)
    expect(outcome.responses[0]?.resultDetail).toContain('Attempting to end parsing')
  })

  test('defaults filetype to sections and context to theme when omitted', async () => {
    const outcome = await computeThemeValidation({
      filename: 'hero.liquid',
      code: '{{ section.settings.title }}',
    })

    expect(outcome.success).toBe(true)
    expect(outcome.responses[0]?.result).toBe(ValidationResult.SUCCESS)
  })

  test('reads codeblock content from --file (filePath)', async () => {
    await inTemporaryDirectory(async (root) => {
      const filePath = joinPath(root, 'hero.liquid')
      await writeFile(filePath, '{{ section.settings.title }}')

      const outcome = await computeThemeValidation({filename: 'hero.liquid', filePath})

      expect(outcome.success).toBe(true)
      expect(outcome.responses[0]?.result).toBe(ValidationResult.SUCCESS)
    })
  })

  test('a missing --file yields a structured FAILED response', async () => {
    await inTemporaryDirectory(async (root) => {
      const outcome = await computeThemeValidation({
        filename: 'hero.liquid',
        filePath: joinPath(root, 'does-not-exist.liquid'),
      })

      expect(outcome.success).toBe(false)
      expect(outcome.responses[0]?.result).toBe(ValidationResult.FAILED)
      expect(outcome.responses[0]?.resultDetail).toContain('Could not read --file')
    })
  })
})

describe('computeThemeValidation - full app mode', () => {
  test('buckets offenses by file: ERROR fails, WARNING-only informs', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeTheme(root, {
        'snippets/broken.liquid': '{% if product %}',
        'snippets/ok.liquid': '<div>{{ product.title }}</div>',
      })

      const outcome = await computeThemeValidation({
        themePath: root,
        files: 'snippets/broken.liquid, snippets/ok.liquid',
      })

      expect(outcome.success).toBe(false)
      expect(outcome.responses[0]?.result).toBe(ValidationResult.FAILED)
      expect(outcome.responses[0]?.resultDetail).toContain('snippets/broken.liquid')
      expect(outcome.responses[1]?.result).toBe(ValidationResult.INFORM)
    })
  })

  test('a requested file with no offenses passes', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeTheme(root, {'snippets/broken.liquid': '{% if product %}'})

      const outcome = await computeThemeValidation({
        themePath: root,
        files: 'snippets/absent.liquid',
      })

      expect(outcome.success).toBe(true)
      expect(outcome.responses[0]?.result).toBe(ValidationResult.SUCCESS)
      expect(outcome.responses[0]?.resultDetail).toContain('passed all checks.')
    })
  })
})

describe('computeThemeValidation - input errors', () => {
  test('requires a mode', async () => {
    const outcome = await computeThemeValidation({})
    expect(outcome.success).toBe(false)
    expect(outcome.responses[0]?.resultDetail).toContain('Provide either --theme-path')
  })

  test('requires at least one file in full app mode', async () => {
    const outcome = await computeThemeValidation({themePath: '/tmp/theme', files: '  ,  '})
    expect(outcome.success).toBe(false)
    expect(outcome.responses[0]?.resultDetail).toContain('--files must list at least one')
  })

  test('requires content in codeblock mode', async () => {
    const outcome = await computeThemeValidation({filename: 'x.liquid'})
    expect(outcome.success).toBe(false)
    expect(outcome.responses[0]?.resultDetail).toContain('Provide --code or --file')
  })

  test('rejects an invalid filetype', async () => {
    const outcome = await computeThemeValidation({filename: 'x.liquid', filetype: 'nope', code: '{{ x }}'})
    expect(outcome.success).toBe(false)
    expect(outcome.responses[0]?.resultDetail).toContain('Invalid --filetype')
  })

  test('rejects an invalid context', async () => {
    const outcome = await computeThemeValidation({filename: 'x.liquid', context: 'nope', code: '{{ x }}'})
    expect(outcome.success).toBe(false)
    expect(outcome.responses[0]?.resultDetail).toContain('Invalid --context')
  })
})

describe('runThemeValidation - rendering, json shape and exit codes', () => {
  test('--json prints the {success, responses} payload and does not throw on pass', async () => {
    await runThemeValidation({
      filename: 'hero.liquid',
      filetype: 'sections',
      code: '{{ section.settings.title }}',
      json: true,
    })

    expect(vi.mocked(outputResult)).toHaveBeenCalledOnce()
    const payload = JSON.parse(vi.mocked(outputResult).mock.calls[0]![0] as string)
    expect(payload.success).toBe(true)
    expect(Array.isArray(payload.responses)).toBe(true)
    // The json contract is `{result, resultDetail}` per response, with NO
    // artifact-id lineage (deterministic output).
    expect(payload.responses[0]).toHaveProperty('result')
    expect(payload.responses[0]).toHaveProperty('resultDetail')
    expect(payload.responses[0]).not.toHaveProperty('artifactId')
    expect(payload.responses[0]).not.toHaveProperty('artifactRevision')
  })

  test('--json throws AbortSilentError on failure after printing the payload', async () => {
    await expect(
      runThemeValidation({filename: 'broken.liquid', filetype: 'snippets', code: '{% if product %}', json: true}),
    ).rejects.toThrow(AbortSilentError)

    const payload = JSON.parse(vi.mocked(outputResult).mock.calls.at(-1)![0] as string)
    expect(payload.success).toBe(false)
    expect(payload.responses[0].result).toBe('failed')
  })

  test('--json turns a bad --file into a structured FAILED payload (no crash)', async () => {
    await inTemporaryDirectory(async (root) => {
      await expect(
        runThemeValidation({
          filename: 'hero.liquid',
          filePath: joinPath(root, 'missing.liquid'),
          json: true,
        }),
      ).rejects.toThrow(AbortSilentError)

      const payload = JSON.parse(vi.mocked(outputResult).mock.calls.at(-1)![0] as string)
      expect(payload.success).toBe(false)
      expect(payload.responses[0].result).toBe('failed')
      expect(payload.responses[0].resultDetail).toContain('Could not read --file')
    })
  })

  test('human output renders an error and throws on failure', async () => {
    await expect(
      runThemeValidation({filename: 'broken.liquid', filetype: 'snippets', code: '{% if product %}', json: false}),
    ).rejects.toThrow(AbortSilentError)

    expect(vi.mocked(renderError)).toHaveBeenCalledOnce()
  })

  test('human output renders success and does not throw on pass', async () => {
    await runThemeValidation({
      filename: 'hero.liquid',
      filetype: 'sections',
      code: '{{ section.settings.title }}',
      json: false,
    })

    expect(vi.mocked(renderSuccess)).toHaveBeenCalledOnce()
    expect(vi.mocked(renderError)).not.toHaveBeenCalled()
  })

  test('converts an engine error into a FAILED json payload', async () => {
    await inTemporaryDirectory(async (root) => {
      // A nonexistent theme path makes theme-check throw (ENOENT); the service
      // must surface that as a FAILED response, not an unhandled rejection.
      // (A missing `locales` dir alone does NOT make theme-check throw.)
      const missingTheme = joinPath(root, 'not-a-theme')

      await expect(
        runThemeValidation({themePath: missingTheme, files: 'snippets/ok.liquid', json: true}),
      ).rejects.toThrow(AbortSilentError)

      const payload = JSON.parse(vi.mocked(outputResult).mock.calls.at(-1)![0] as string)
      expect(payload.success).toBe(false)
      expect(payload.responses[0].result).toBe('failed')
    })
  })

  test('renderWarning is used when a file passes with only non-error findings', async () => {
    await inTemporaryDirectory(async (root) => {
      await writeTheme(root, {'snippets/ok.liquid': '<div>{{ product.title }}</div>'})

      await runThemeValidation({themePath: root, files: 'snippets/ok.liquid', json: false})

      expect(vi.mocked(renderWarning)).toHaveBeenCalledOnce()
      expect(vi.mocked(renderError)).not.toHaveBeenCalled()
    })
  })
})
