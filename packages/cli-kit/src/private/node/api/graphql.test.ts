import {
  errorHandler,
  extractErrorMessages,
  extractGraphQLErrorMeta,
  findCommonPathPrefix,
  parseRubyStackEntry,
  stripDeploymentPrefix,
} from './graphql.js'
import {GraphQLClientError} from './headers.js'
import {AbortError} from '../../../public/node/error.js'
import {ClientError} from 'graphql-request'
import {describe, test, expect} from 'vitest'

describe('extractErrorMessages', () => {
  test('extracts messages from a standard GraphQL error array', () => {
    const errors = [{message: 'First error'}, {message: 'Second error'}]
    expect(extractErrorMessages(errors)).toEqual(['First error', 'Second error'])
  })

  test('deduplicates identical messages', () => {
    const errors = [{message: 'Same error'}, {message: 'Same error'}, {message: 'Different error'}]
    expect(extractErrorMessages(errors)).toEqual(['Same error', 'Different error'])
  })

  test('filters out entries without a message field', () => {
    const errors = [{message: 'Valid'}, {code: 'INVALID'}, {message: ''}]
    expect(extractErrorMessages(errors)).toEqual(['Valid'])
  })

  test('returns empty array for non-array input', () => {
    expect(extractErrorMessages(undefined)).toEqual([])
    expect(extractErrorMessages(null)).toEqual([])
    expect(extractErrorMessages('string')).toEqual([])
  })

  test('returns empty array for empty errors', () => {
    expect(extractErrorMessages([])).toEqual([])
  })
})

describe('extractGraphQLErrorMeta', () => {
  test('extracts request_id from error extensions', () => {
    const errors = [{message: 'err', extensions: {request_id: 'abc-123'}}]
    expect(extractGraphQLErrorMeta(errors).requestId).toBe('abc-123')
  })

  test('extracts exception_class from error extensions', () => {
    const errors = [{message: 'err', extensions: {exception_class: 'PublicMessageError'}}]
    expect(extractGraphQLErrorMeta(errors).exceptionClass).toBe('PublicMessageError')
  })

  test('preserves full source path when no stack trace is available for prefix computation', () => {
    const errors = [
      {
        message: 'err',
        extensions: {
          source: {
            file: '/Users/mitch/world/trees/root/src/areas/core/shopify/static_asset_pipeline.rb',
            line: 37,
          },
        },
      },
    ]
    const meta = extractGraphQLErrorMeta(errors)
    // With only one path, no common prefix can be computed — full path preserved
    const expectedPath = '/Users/mitch/world/trees/root/src/areas/core/shopify/static_asset_pipeline.rb'
    expect(meta.sourceFile).toBe(expectedPath)
    expect(meta.sourceLine).toBe(37)
  })

  test('strips to components/ boundary for Shopify monorepo paths', () => {
    const errors = [
      {
        message: 'err',
        extensions: {
          source: {
            file: '/Users/mitch/world/trees/root/src/areas/core/shopify/components/apps/framework/app/services/pipeline.rb',
            line: 37,
          },
          app_stacktrace: [
            "/Users/mitch/world/trees/root/src/areas/core/shopify/components/apps/framework/app/services/pipeline.rb:37:in 'Kernel#throw'",
            "/Users/mitch/world/trees/root/src/areas/core/shopify/components/apps/app/plugins/handler.rb:20:in 'Handler#process'",
          ],
        },
      },
    ]
    const meta = extractGraphQLErrorMeta(errors)
    // Paths are stripped to start from "components/"
    expect(meta.sourceFile).toBe('components/apps/framework/app/services/pipeline.rb')
    expect(meta.stackTrace[0]!.file).toBe('components/apps/framework/app/services/pipeline.rb')
    expect(meta.stackTrace[1]!.file).toBe('components/apps/app/plugins/handler.rb')
  })

  test('falls back to common prefix stripping for non-monorepo paths', () => {
    const errors = [
      {
        message: 'err',
        extensions: {
          source: {
            file: '/deploy/app/src/areas/core/services/pipeline.rb',
            line: 37,
          },
          app_stacktrace: [
            "/deploy/app/src/areas/core/services/pipeline.rb:37:in 'Kernel#throw'",
            "/deploy/app/src/areas/plugins/asset_handler.rb:20:in 'Handler#process'",
          ],
        },
      },
    ]
    const meta = extractGraphQLErrorMeta(errors)
    // No "components/" marker — common prefix "/deploy/app/src/areas/" is stripped
    expect(meta.sourceFile).toBe('core/services/pipeline.rb')
    expect(meta.stackTrace[0]!.file).toBe('core/services/pipeline.rb')
    expect(meta.stackTrace[1]!.file).toBe('plugins/asset_handler.rb')
  })

  test('extracts stack trace entries from app_stacktrace', () => {
    const errors = [
      {
        message: 'err',
        extensions: {
          app_stacktrace: [
            "/path/to/services/static_asset_pipeline.rb:37:in 'Kernel#throw'",
            "/path/to/models/app_version.rb:42:in 'Apps::Operations::StaticAssetPipeline.perform'",
          ],
        },
      },
    ]
    const meta = extractGraphQLErrorMeta(errors)
    expect(meta.stackTrace).toHaveLength(2)
    // Common prefix "/path/to/" is stripped
    expect(meta.stackTrace[0]).toEqual({
      file: 'services/static_asset_pipeline.rb',
      line: '37',
      method: 'Kernel#throw',
    })
    expect(meta.stackTrace[1]).toEqual({
      file: 'models/app_version.rb',
      line: '42',
      method: 'StaticAssetPipeline.perform',
    })
  })

  test('returns the first request_id found when multiple errors have one', () => {
    const errors = [
      {message: 'err1', extensions: {request_id: 'first-id'}},
      {message: 'err2', extensions: {request_id: 'second-id'}},
    ]
    expect(extractGraphQLErrorMeta(errors).requestId).toBe('first-id')
  })

  test('skips errors without extensions', () => {
    const errors = [{message: 'no ext'}, {message: 'has ext', extensions: {request_id: 'found-id'}}]
    expect(extractGraphQLErrorMeta(errors).requestId).toBe('found-id')
  })

  test('returns empty meta for non-array input', () => {
    const meta = extractGraphQLErrorMeta(undefined)
    expect(meta.requestId).toBeUndefined()
    expect(meta.exceptionClass).toBeUndefined()
    expect(meta.stackTrace).toEqual([])
  })

  test('returns empty meta when no extensions are present', () => {
    const errors = [{message: 'no extensions'}]
    const meta = extractGraphQLErrorMeta(errors)
    expect(meta.requestId).toBeUndefined()
    expect(meta.exceptionClass).toBeUndefined()
    expect(meta.sourceFile).toBeUndefined()
    expect(meta.stackTrace).toEqual([])
  })
})

describe('findCommonPathPrefix', () => {
  test('finds the common directory prefix across multiple paths', () => {
    const paths = [
      '/Users/mitch/world/trees/root/src/areas/core/services/pipeline.rb',
      '/Users/mitch/world/trees/root/src/areas/plugins/handler.rb',
    ]
    expect(findCommonPathPrefix(paths)).toBe('/Users/mitch/world/trees/root/src/areas/')
  })

  test('works with non-trees paths (e.g. production deployments)', () => {
    const paths = ['/app/src/services/pipeline.rb', '/app/src/models/version.rb']
    expect(findCommonPathPrefix(paths)).toBe('/app/src/')
  })

  test('returns empty string for fewer than 2 non-empty paths', () => {
    expect(findCommonPathPrefix([])).toBe('')
    expect(findCommonPathPrefix(['/path/to/file.rb'])).toBe('')
    expect(findCommonPathPrefix(['', ''])).toBe('')
  })

  test('returns empty string when paths share only the leading "/"', () => {
    const paths = ['/usr/local/lib/file.rb', '/app/src/file.rb']
    expect(findCommonPathPrefix(paths)).toBe('')
  })

  test('ignores empty strings in the paths array', () => {
    const paths = ['', '/app/src/services/a.rb', '', '/app/src/models/b.rb']
    expect(findCommonPathPrefix(paths)).toBe('/app/src/')
  })

  test('handles paths without directory separators', () => {
    const paths = ['file_a.rb', 'file_b.rb']
    expect(findCommonPathPrefix(paths)).toBe('')
  })
})

describe('stripDeploymentPrefix', () => {
  test('strips everything before "components/" in a Shopify monorepo path', () => {
    const path = '/Users/mitch/world/trees/root/src/areas/core/shopify/components/apps/framework/app/services/pipeline.rb'
    expect(stripDeploymentPrefix(path)).toBe('components/apps/framework/app/services/pipeline.rb')
  })

  test('works with any deployment root before components/', () => {
    expect(stripDeploymentPrefix('/app/src/areas/core/shopify/components/apps/file.rb')).toBe(
      'components/apps/file.rb',
    )
    expect(stripDeploymentPrefix('/home/deploy/components/gems/my_gem/lib/file.rb')).toBe(
      'components/gems/my_gem/lib/file.rb',
    )
  })

  test('returns path unchanged when no structural marker is found', () => {
    expect(stripDeploymentPrefix('/app/src/services/pipeline.rb')).toBe('/app/src/services/pipeline.rb')
  })

  test('handles empty string', () => {
    expect(stripDeploymentPrefix('')).toBe('')
  })
})

describe('parseRubyStackEntry', () => {
  test('parses a standard Ruby stack trace entry preserving raw file path', () => {
    const entry = "/Users/mitch/world/trees/root/src/areas/core/static_asset_pipeline.rb:37:in 'Kernel#throw'"
    expect(parseRubyStackEntry(entry)).toEqual({
      file: '/Users/mitch/world/trees/root/src/areas/core/static_asset_pipeline.rb',
      line: '37',
      method: 'Kernel#throw',
    })
  })

  test('shortens fully-qualified Ruby method names', () => {
    const entry = "/path/to/static_asset_pipeline.rb:37:in 'Apps::Operations::StaticAssetPipeline.perform'"
    expect(parseRubyStackEntry(entry)).toEqual({
      file: '/path/to/static_asset_pipeline.rb',
      line: '37',
      method: 'StaticAssetPipeline.perform',
    })
  })

  test('handles instance methods with #', () => {
    const entry =
      "/path/to/static_asset_pipeline.rb:20:in 'Apps::HostedApp::Plugins::StaticAssetPipeline#app_version_transform'"
    expect(parseRubyStackEntry(entry)).toEqual({
      file: '/path/to/static_asset_pipeline.rb',
      line: '20',
      method: 'StaticAssetPipeline#app_version_transform',
    })
  })

  test('handles "block in" methods', () => {
    const entry =
      "/path/to/app_version_lifecycle.rb:26:in 'block in AppModules::Systems::Plugins::Executors::AppVersionLifecycle#transform'"
    expect(parseRubyStackEntry(entry)).toEqual({
      file: '/path/to/app_version_lifecycle.rb',
      line: '26',
      method: 'AppVersionLifecycle#transform',
    })
  })

  test('handles entries without method name', () => {
    const entry = '/path/to/some_file.rb:42'
    expect(parseRubyStackEntry(entry)).toEqual({
      file: '/path/to/some_file.rb',
      line: '42',
      method: '',
    })
  })

  test('falls back to raw entry when nothing matches', () => {
    const entry = 'some random text'
    expect(parseRubyStackEntry(entry)).toEqual({
      file: '',
      line: undefined,
      method: 'some random text',
    })
  })
})

function buildClientError(status: number, errors: any[]): ClientError {
  const response = {
    status,
    headers: new Map(),
    errors,
    data: undefined,
  }
  return new ClientError(response, {query: 'query { shop { name } }'})
}

/** Builds a realistic 500 error matching the user's original bug report */
function buildRealisticServerError(): ClientError {
  return buildClientError(500, [
    {
      message: 'uncaught throw #<StandardError: Not implemented>',
      extensions: {
        request_id: '57c09886-d853-485a-85a2-a556229304c2',
        exception_class: 'PublicMessageError',
        message: 'uncaught throw #<StandardError: Not implemented>',
        source: {
          file: '/Users/mitch/world/trees/root/src/areas/core/shopify/components/apps/framework/app/services/apps/operations/static_asset_pipeline.rb',
          line: 37,
        },
        app_stacktrace: [
          "/Users/mitch/world/trees/root/src/areas/core/shopify/components/apps/framework/app/services/apps/operations/static_asset_pipeline.rb:37:in 'Kernel#throw'",
          "/Users/mitch/world/trees/root/src/areas/core/shopify/components/apps/framework/app/services/apps/operations/static_asset_pipeline.rb:37:in 'Apps::Operations::StaticAssetPipeline.perform'",
          "/Users/mitch/world/trees/root/src/areas/core/shopify/components/apps/app/services/apps/hosted_app/plugins/static_asset_pipeline.rb:20:in 'Apps::HostedApp::Plugins::StaticAssetPipeline#app_version_transform'",
          "/Users/mitch/world/trees/root/src/areas/core/shopify/components/apps/framework/app/models/app_modules/systems/plugins/executors/app_version_lifecycle.rb:26:in 'block in AppModules::Systems::Plugins::Executors::AppVersionLifecycle#transform'",
        ],
      },
    },
  ])
}

describe('errorHandler', () => {
  const handler = errorHandler('App Management')

  describe('server errors (5xx)', () => {
    test('creates an AbortError for 500 status', () => {
      const result = handler(buildRealisticServerError())
      expect(result).toBeInstanceOf(AbortError)
    })

    test('includes the API name and status in the message', () => {
      const result = handler(buildRealisticServerError()) as AbortError
      expect(result.message).toContain('App Management')
      expect(result.message).toContain('500')
    })

    test('includes the human-readable error message without raw JSON', () => {
      const result = handler(buildRealisticServerError()) as AbortError

      expect(result.message).toContain('uncaught throw #<StandardError: Not implemented>')
      expect(result.message).not.toContain('"extensions"')
      expect(result.message).not.toContain('"app_stacktrace"')
      expect(result.message).not.toContain('"exception_class"')
    })

    test('uses bold formatting for the error message text', () => {
      const result = handler(buildRealisticServerError()) as AbortError
      const formatted = result.formattedMessage
      expect(formatted).toBeDefined()
      const serialized = JSON.stringify(formatted)
      expect(serialized).toContain('"bold"')
      expect(serialized).toContain('uncaught throw #<StandardError: Not implemented>')
    })

    test('does not include next steps', () => {
      const result = handler(buildRealisticServerError()) as AbortError
      expect(result.nextSteps).toBeUndefined()
    })

    test('includes a Request ID custom section', () => {
      const result = handler(buildRealisticServerError()) as AbortError

      const requestIdSection = result.customSections?.find((sec) => sec.title === 'Request ID')
      expect(requestIdSection).toBeDefined()
      expect(JSON.stringify(requestIdSection!.body)).toContain('57c09886-d853-485a-85a2-a556229304c2')
    })

    test('includes an Exception custom section with class and stripped source path', () => {
      const result = handler(buildRealisticServerError()) as AbortError

      const exceptionSection = result.customSections?.find((sec) => sec.title === 'Exception')
      expect(exceptionSection).toBeDefined()
      const body = JSON.stringify(exceptionSection!.body)
      expect(body).toContain('PublicMessageError')
      // Paths start from the "components/" structural boundary
      expect(body).toContain(
        'components/apps/framework/app/services/apps/operations/static_asset_pipeline.rb:37',
      )
      expect(body).not.toContain('/Users/mitch/world/trees/root/')
    })

    test('includes a Stack trace custom section with stripped file paths', () => {
      const result = handler(buildRealisticServerError()) as AbortError

      const stackSection = result.customSections?.find((sec) => sec.title === 'Stack trace')
      expect(stackSection).toBeDefined()
      const body = JSON.stringify(stackSection!.body)
      // Method names should be shortened (no full namespace)
      expect(body).toContain('Kernel#throw')
      expect(body).toContain('StaticAssetPipeline.perform')
      // Paths start from the "components/" structural boundary
      expect(body).toContain(
        'components/apps/framework/app/services/apps/operations/static_asset_pipeline.rb:37',
      )
      expect(body).not.toContain('/Users/mitch/world/trees/root/')
    })

    test('uses the passed-in requestId as fallback when extensions lack one', () => {
      const errors = [{message: 'err'}]
      const result = handler(buildClientError(500, errors), 'fallback-request-id') as AbortError

      const requestIdSection = result.customSections?.find((sec) => sec.title === 'Request ID')
      expect(requestIdSection).toBeDefined()
      expect(JSON.stringify(requestIdSection!.body)).toContain('fallback-request-id')
    })

    test('prefers request_id from extensions over the passed-in requestId', () => {
      const errors = [{message: 'err', extensions: {request_id: 'from-extensions'}}]
      const result = handler(buildClientError(500, errors), 'from-header') as AbortError

      const requestIdSection = result.customSections?.find((sec) => sec.title === 'Request ID')
      expect(JSON.stringify(requestIdSection!.body)).toContain('from-extensions')
      expect(JSON.stringify(requestIdSection!.body)).not.toContain('from-header')
    })

    test('does not show custom sections when no metadata is available', () => {
      const errors = [{message: 'bare error'}]
      const result = handler(buildClientError(500, errors)) as AbortError

      expect(result.customSections).toEqual([])
    })

    test('truncates long stack traces with a count of remaining entries', () => {
      const stacktrace = Array.from({length: 20}, (_, idx) => `/path/to/file.rb:${idx + 1}:in 'Method${idx}'`)
      const errors = [{message: 'err', extensions: {app_stacktrace: stacktrace}}]
      const result = handler(buildClientError(500, errors)) as AbortError

      const stackSection = result.customSections?.find((sec) => sec.title === 'Stack trace')
      expect(stackSection).toBeDefined()
      const body = JSON.stringify(stackSection!.body)
      // Should show 8 entries max and indicate remaining
      expect(body).toContain('12 more')
    })
  })

  describe('client errors (4xx and 200 with errors)', () => {
    test('creates a GraphQLClientError for status < 500', () => {
      const errors = [{message: 'Bad request'}]
      const result = handler(buildClientError(400, errors))
      expect(result).toBeInstanceOf(GraphQLClientError)
    })

    test('creates a GraphQLClientError for status 200 with errors', () => {
      const errors = [{message: 'Validation failed'}]
      const result = handler(buildClientError(200, errors))
      expect(result).toBeInstanceOf(GraphQLClientError)
    })

    test('includes a clean error message without raw JSON', () => {
      const errors = [{message: 'Field is invalid'}]
      const result = handler(buildClientError(400, errors)) as GraphQLClientError

      expect(result.message).toContain('Field is invalid')
      expect(result.message).toContain('App Management')
      expect(result.message).not.toContain('[')
      expect(result.message).not.toContain('{')
    })

    test('includes bullet points for multiple errors', () => {
      const errors = [{message: 'Error one'}, {message: 'Error two'}]
      const result = handler(buildClientError(400, errors)) as GraphQLClientError

      expect(result.message).toContain('• Error one')
      expect(result.message).toContain('• Error two')
    })

    test('includes status code for non-200 statuses', () => {
      const errors = [{message: 'Unauthorized'}]
      const result = handler(buildClientError(401, errors)) as GraphQLClientError
      expect(result.message).toContain('(401)')
    })

    test('omits status code for 200 with errors', () => {
      const errors = [{message: 'Something went wrong'}]
      const result = handler(buildClientError(200, errors)) as GraphQLClientError
      expect(result.message).not.toContain('(200)')
    })

    test('enriches client errors with custom sections when extensions are present', () => {
      const errors = [{message: 'err', extensions: {request_id: 'client-req-id'}}]
      const result = handler(buildClientError(400, errors)) as GraphQLClientError

      const requestIdSection = result.customSections?.find((sec) => sec.title === 'Request ID')
      expect(requestIdSection).toBeDefined()
      expect(JSON.stringify(requestIdSection!.body)).toContain('client-req-id')
    })

    test('preserves the original errors array', () => {
      const errors = [{message: 'err', extensions: {code: 'VALIDATION'}}]
      const result = handler(buildClientError(400, errors)) as GraphQLClientError
      expect(result.errors).toEqual(errors)
    })
  })

  test('returns non-ClientError errors unchanged', () => {
    const error = new Error('some other error')
    const result = handler(error)
    expect(result).toBe(error)
  })
})
