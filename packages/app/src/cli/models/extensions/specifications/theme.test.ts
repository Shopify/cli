import themeSpec, {MAX_ALLOWED_SOURCES, normalizeAllowedSource} from './theme.js'
import {UIExtensionSchema} from './ui_extension.js'
import {describe, expect, test} from 'vitest'

function parse(capabilities?: object) {
  return themeSpec.parseConfigurationObject({
    name: 'theme extension',
    type: 'theme',
    ...(capabilities === undefined ? {} : {capabilities}),
  })
}

function parseSources(allowedSources: unknown) {
  return parse({network_access: {allowed_sources: allowedSources}})
}

function errorMessages(result: ReturnType<typeof parse>) {
  return result.state === 'error' ? result.errors.map((error) => error.message) : []
}

describe('theme', () => {
  describe('capabilities.network_access.allowed_sources', () => {
    test('accepts HTTPS origins and normalizes them', () => {
      const result = parseSources([
        'https://api.example.com',
        ' HTTPS://CDN.Example.com/ ',
        'https://*.cdn.example.com',
        'https://api.example.com:443',
        'https://api.example.com:8443',
      ])

      expect(result.state).toBe('ok')
      expect(result.data?.capabilities?.network_access).toEqual({
        allowed_sources: [
          'https://api.example.com',
          'https://cdn.example.com',
          'https://*.cdn.example.com',
          'https://api.example.com:8443',
        ],
      })
    })

    test('accepts an empty list', () => {
      const result = parseSources([])

      expect(result.state).toBe('ok')
      expect(result.data?.capabilities?.network_access).toEqual({allowed_sources: []})
    })

    test('leaves network_access undefined when it is omitted', () => {
      expect(parse().data?.capabilities).toBeUndefined()
      expect(parse({}).data?.capabilities?.network_access).toBeUndefined()
    })

    test('ignores a boolean network_access, as before', () => {
      const result = parse({network_access: true})

      expect(result.state).toBe('ok')
      expect(result.data?.capabilities?.network_access).toBeUndefined()
    })

    test('requires allowed_sources when the network_access table is declared', () => {
      const result = parse({network_access: {}})

      expect(result.state).toBe('error')
      expect(errorMessages(result)).toEqual([
        'allowed_sources is required. Use an empty list if your extension contacts no other origins.',
      ])
    })

    test('rejects a value that is not a list', () => {
      const result = parseSources('https://api.example.com')

      expect(result.state).toBe('error')
      expect(errorMessages(result)).toEqual([
        'allowed_sources must be a list of HTTPS origins, like ["https://api.example.com"]',
      ])
    })

    test('rejects a network_access value that is neither a table nor a boolean', () => {
      const result = parse({network_access: 'https://api.example.com'})

      expect(result.state).toBe('error')
      expect(errorMessages(result)).toEqual([
        'network_access must be a table with an allowed_sources list for theme app extensions',
      ])
    })

    test.each([
      ['an http origin', 'http://api.example.com'],
      ['a missing scheme', 'api.example.com'],
      ['a path', 'https://api.example.com/v1'],
      ['a query', 'https://api.example.com?a=b'],
      ['a fragment', 'https://api.example.com#a'],
      ['credentials', 'https://user@api.example.com'],
      ['a bare wildcard', '*'],
      ['a wildcard on a top-level domain', 'https://*.com'],
      ['a wildcard on a single label', 'https://*.example'],
      ['a wildcard that is not the leading label', 'https://api.*.example.com'],
      ['a single-label host', 'https://localhost'],
      ['an IP address', 'https://127.0.0.1'],
      ['an IP address with a hexadecimal final label', 'https://127.0.0x1'],
      ['an IP address in hexadecimal notation', 'https://0x7f.0x1'],
      ['a link-local IP address in hexadecimal notation', 'https://0xa9.0xfe.0xa9.0xfe'],
      ['a wildcard on an IP address', 'https://*.127.0.0.1'],
      ['a wildcard on an IP address in hexadecimal notation', 'https://*.0x7f.0x1'],
      ['a host that cannot be parsed as a URL', 'https://example.0xabc'],
      ['a wildcard on a host that cannot be parsed as a URL', 'https://*.example.0xabc'],
      ['an invalid label', 'https://-api.example.com'],
      ['an empty label', 'https://api..example.com'],
      ['a trailing dot', 'https://api.example.com./'],
      ['a newline', 'https://api.example.com\nhttps://other.example.com'],
      ['port 0', 'https://api.example.com:0'],
      ['a port above 65535', 'https://api.example.com:65536'],
      ['a CSP keyword', "'self'"],
      ['a CSP injection', 'https://api.example.com; script-src *'],
    ])('rejects %s', (_description, source) => {
      const result = parseSources(['https://ok.example.com', source])

      expect(result.state).toBe('error')
      expect(errorMessages(result)).toEqual([
        `Invalid allowed_sources: ${JSON.stringify(
          source,
        )}. Use HTTPS origins with no path, query or fragment, like "https://api.example.com" or "https://*.cdn.example.com".`,
      ])
    })

    test(`accepts up to ${MAX_ALLOWED_SOURCES} origins after removing duplicates`, () => {
      const sources = Array.from({length: MAX_ALLOWED_SOURCES}, (_, index) => `https://api${index}.example.com`)

      expect(parseSources([...sources, 'HTTPS://API0.EXAMPLE.COM']).state).toBe('ok')
    })

    test(`rejects more than ${MAX_ALLOWED_SOURCES} origins`, () => {
      const sources = Array.from({length: MAX_ALLOWED_SOURCES + 1}, (_, index) => `https://api${index}.example.com`)
      const result = parseSources(sources)

      expect(result.state).toBe('error')
      expect(errorMessages(result)).toEqual([`allowed_sources can list up to ${MAX_ALLOWED_SOURCES} origins`])
    })
  })

  describe('normalizeAllowedSource', () => {
    test('rejects a host longer than 253 characters', () => {
      const host = `${'a'.repeat(60)}.`.repeat(5).concat('com')

      expect(host.length).toBeGreaterThan(253)
      expect(normalizeAllowedSource(`https://${host}`)).toBeUndefined()
    })
  })

  describe('deployConfig', () => {
    test('sends only the theme extension files when network_access is omitted', async () => {
      const config = parse().data!

      await expect(themeSpec.deployConfig?.(config, '', '', undefined)).resolves.toEqual({theme_extension: {files: {}}})
    })

    test('sends only the theme extension files when network_access is a boolean', async () => {
      const config = parse({network_access: true, block_progress: true}).data!

      await expect(themeSpec.deployConfig?.(config, '', '', undefined)).resolves.toEqual({theme_extension: {files: {}}})
    })

    test('sends the normalized allowed sources when they are declared', async () => {
      const config = parseSources(['https://API.example.com/', 'https://*.cdn.example.com']).data!

      await expect(themeSpec.deployConfig?.(config, '', '', undefined)).resolves.toEqual({
        theme_extension: {files: {}},
        capabilities: {network_access: {allowed_sources: ['https://api.example.com', 'https://*.cdn.example.com']}},
      })
    })

    test('sends an empty list when allowed_sources is empty', async () => {
      const config = parseSources([]).data!

      await expect(themeSpec.deployConfig?.(config, '', '', undefined)).resolves.toEqual({
        theme_extension: {files: {}},
        capabilities: {network_access: {allowed_sources: []}},
      })
    })
  })

  describe('UI extensions', () => {
    test('still accept a boolean network_access', () => {
      const result = UIExtensionSchema.safeParse({
        name: 'ui extension',
        type: 'ui_extension',
        extension_points: [],
        capabilities: {network_access: true},
      })

      expect(result.success).toBe(true)
      expect(result.data?.capabilities?.network_access).toBe(true)
    })

    test('reject a network_access table', () => {
      const result = UIExtensionSchema.safeParse({
        name: 'ui extension',
        type: 'ui_extension',
        extension_points: [],
        capabilities: {network_access: {allowed_sources: ['https://api.example.com']}},
      })

      expect(result.success).toBe(false)
    })
  })
})
