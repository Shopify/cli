import {getRegistry} from '../registry/index.js'
import {DETERMINISTIC_CHECKS} from '../scanners/index.js'
import {parseAppToml} from '../scanners/discover.js'
import {
  scanCredentialBrowserLeakage,
  scanCredentialLogLeakage,
  scanRequestControlledAdminContext,
  scanUnauthenticatedEndpoints,
  scanUnsafeInnerHTML,
} from '../rules/js-rules.js'
import {scanLiquidSecurity} from '../rules/liquid-rules.js'
import {scanStaticFrameAncestors} from '../rules/csp-rules.js'
import {describe, expect, test} from 'vitest'
import type {SourceFile} from '../rules/types.js'

const ACTIVE_IDS = [
  'MISSING_COMPLIANCE_WEBHOOKS',
  'MISSING_DEPENDENCY_SECURITY_AUTOMATION',
  'EOL_API_VERSION',
  'EXPIRING_OFFLINE_TOKEN',
  'UNAUTHENTICATED_ENDPOINT',
  'REQUEST_CONTROLLED_ADMIN_CONTEXT',
  'DEPRECATED_SCRIPT_TAG_SCOPE',
  'INSECURE_WEBHOOK_URL',
  'COMMITTED_SECRET',
  'CREDENTIAL_LOG_LEAKAGE',
  'CREDENTIAL_BROWSER_LEAKAGE',
  'LIQUID_UNSAFE_RENDER',
  'UNSAFE_INNERHTML',
  'APP_PROXY_LIQUID_INJECTION',
  'STATIC_FRAME_ANCESTORS',
].sort()

const source = (content: string, path = 'app/routes/example.tsx'): SourceFile => ({
  path,
  absolutePath: `/${path}`,
  ext: path.endsWith('.liquid') ? '.liquid' : '.tsx',
  content,
})

describe('deterministic rules product contract', () => {
  test('registers every active executable deterministic identity with a runnable definition', () => {
    expect([...DETERMINISTIC_CHECKS.keys()].sort()).toEqual(ACTIVE_IDS)
    expect([...DETERMINISTIC_CHECKS.values()].every((check) => check.lifecycle === 'active' && check.runner)).toBe(true)
    const registry = getRegistry()
    expect(registry.some((entry) => entry.id === 'TOKEN_LEAKAGE')).toBe(false)
  })

  test('bumps deterministic versions when scanner behavior changes', () => {
    expect(DETERMINISTIC_CHECKS.get('REQUEST_CONTROLLED_ADMIN_CONTEXT')?.version).toBe(4)
    expect(DETERMINISTIC_CHECKS.get('APP_PROXY_LIQUID_INJECTION')?.version).toBe(3)
    expect(DETERMINISTIC_CHECKS.get('INSECURE_WEBHOOK_URL')?.version).toBe(2)
    expect(DETERMINISTIC_CHECKS.get('COMMITTED_SECRET')?.version).toBe(4)
    expect(DETERMINISTIC_CHECKS.get('UNAUTHENTICATED_ENDPOINT')?.version).toBe(3)
    expect(DETERMINISTIC_CHECKS.get('EOL_API_VERSION')?.version).toBe(2)
    expect(DETERMINISTIC_CHECKS.get('EXPIRING_OFFLINE_TOKEN')?.version).toBe(2)
    expect(DETERMINISTIC_CHECKS.get('DEPRECATED_SCRIPT_TAG_SCOPE')?.version).toBe(2)
    expect(DETERMINISTIC_CHECKS.get('CREDENTIAL_LOG_LEAKAGE')?.version).toBe(2)
    expect(DETERMINISTIC_CHECKS.get('CREDENTIAL_BROWSER_LEAKAGE')?.version).toBe(2)
    expect(DETERMINISTIC_CHECKS.get('UNSAFE_INNERHTML')?.version).toBe(3)
    expect(DETERMINISTIC_CHECKS.get('LIQUID_UNSAFE_RENDER')?.version).toBe(2)
    expect(DETERMINISTIC_CHECKS.get('STATIC_FRAME_ANCESTORS')?.version).toBe(2)
    expect(DETERMINISTIC_CHECKS.get('MISSING_DEPENDENCY_SECURITY_AUTOMATION')?.version).toBe(2)
  })

  test('extracts security fields from parsed TOML without source regexes', () => {
    const parsed = parseAppToml(
      {
        access_scopes: {
          scopes: 'read_products',
          required_scopes: ['write_script_tags'],
        },
        auth: {redirect_urls: ['https://app.example/callback'], access_mode: 'offline'},
        webhooks: {
          api_version: '2023-07',
          subscriptions: [{compliance_topics: ['shop/redact'], uri: 'pubsub://project:topic'}],
          privacy_compliance: {
            customer_deletion_url: 'https://app.example/customers/redact',
            customer_data_request_url: 'https://app.example/customers/data-request',
          },
        },
        future: {expiring_offline_access_tokens: false},
      },
      '/app/shopify.app.production.toml',
    )
    expect(parsed).toMatchObject({
      scopes: 'read_products,write_script_tags',
      apiVersion: '2023-07',
      redirectUrls: ['https://app.example/callback'],
      webhooks: [
        {topics: ['shop/redact'], uri: 'pubsub://project:topic'},
        {topics: ['customers/redact'], uri: 'https://app.example/customers/redact'},
        {topics: ['customers/data_request'], uri: 'https://app.example/customers/data-request'},
      ],
    })
  })

  test('keeps valid sections when another configuration section is invalid', () => {
    const parsed = parseAppToml(
      {
        access_scopes: {scopes: 'read_products'},
        auth: {redirect_urls: ['https://app.example/callback']},
        webhooks: 'not-a-section',
      },
      '/app/shopify.app.toml',
    )
    expect(parsed.scopes).toBe('read_products')
    expect(parsed.redirectUrls).toEqual(['https://app.example/callback'])
    expect(parsed.webhooks).toEqual([])
    expect(parsed.apiVersion).toBeUndefined()
  })

  test('keeps insecure webhook URIs that the CLI URI validator rejects', () => {
    const parsed = parseAppToml(
      {
        webhooks: {
          api_version: '2023-07',
          subscriptions: [{topics: ['orders/create'], uri: 'http://insecure.example/webhooks'}],
        },
      },
      '/app/shopify.app.toml',
    )
    expect(parsed.webhooks).toEqual([{topics: ['orders/create'], uri: 'http://insecure.example/webhooks'}])
  })

  test('drops webhook subscriptions that are not CLI-shaped', () => {
    const parsed = parseAppToml(
      {
        webhooks: {
          api_version: '2023-07',
          subscriptions: [{not: 'a-subscription'}, {topics: ['orders/create']}],
        },
      },
      '/app/shopify.app.toml',
    )
    expect(parsed.webhooks).toEqual([])
  })

  test('keeps an insecure URI when another subscription field is invalid', () => {
    const parsed = parseAppToml(
      {
        webhooks: {
          api_version: '2023-07',
          subscriptions: [{topics: ['orders/create'], uri: 'http://insecure.example/webhooks', filter: 42}],
        },
      },
      '/app/shopify.app.toml',
    )
    expect(parsed.webhooks).toEqual([{topics: [], uri: 'http://insecure.example/webhooks'}])
  })
})

describe('JavaScript regex mode', () => {
  test('retains the template route-auth heuristic', () => {
    const missing = scanUnauthenticatedEndpoints([
      source('export async function loader({request}: LoaderArgs) { return prisma.order.findMany() }'),
    ])
    expect(missing.issues).toHaveLength(1)
    expect(missing.unresolvedReason).toBeUndefined()

    const authenticated = scanUnauthenticatedEndpoints([
      source(
        'export async function loader({request}: LoaderArgs) { await authenticate.admin(request); return prisma.order.findMany() }',
      ),
    ])
    expect(authenticated.issues).toEqual([])
    expect(authenticated.unresolvedReason).toBeUndefined()

    const unawaited = scanUnauthenticatedEndpoints([
      source(
        'export async function loader({request}: LoaderArgs) { authenticate.admin(request); return prisma.order.findMany() }',
      ),
    ])
    expect(unawaited.issues).toHaveLength(1)
    expect(unawaited.unresolvedReason).toBeUndefined()
  })

  test('detects direct admin-context and credential flows with safe exceptions', () => {
    expect(
      scanRequestControlledAdminContext([source('const shop = request.query.shop; unauthenticated.admin(shop)')]),
    ).toHaveLength(1)
    expect(scanCredentialLogLeakage([source('logger.info({ accessToken })')])).toHaveLength(1)
    expect(scanCredentialLogLeakage([source('logger.info({ hasToken: Boolean(accessToken) })')])).toHaveLength(0)
    expect(scanCredentialBrowserLeakage([source('return json({ accessToken })')])).toHaveLength(1)
    expect(scanUnsafeInnerHTML([source('element.innerHTML = payload')])).toHaveLength(1)
    expect(scanUnsafeInnerHTML([source('// element.innerHTML = payload\nelement.textContent = payload')])).toHaveLength(
      0,
    )
  })
})

describe('STATIC_FRAME_ANCESTORS regex mode', () => {
  test('flags only literal clearly permissive frame-ancestors source tokens', () => {
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': "frame-ancestors *"}`, 'app/root.tsx'),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': "frame-ancestors https://*"}`, 'app/root.tsx'),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': "frame-ancestors *.myshopify.com"}`, 'app/root.tsx'),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {'Content-Security-Policy': "frame-ancestors https://*.myshopify.com"}`,
          'app/root.tsx',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': "frame-ancestors https:"}`, 'app/root.tsx'),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': "frame-ancestors 'self' https:"}`, 'app/root.tsx'),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {'Content-Security-Policy': "frame-ancestors https://admin.shopify.com https://merchant.myshopify.com"}`,
          'app/root.tsx',
        ),
      ]),
    ).toEqual([])
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {'Content-Security-Policy': "frame-ancestors https://*.myshopify.com.evil.test"}`,
          'app/root.tsx',
        ),
      ]),
    ).toEqual([])
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {'Content-Security-Policy': "frame-ancestors https://*.mycompany.dev"}`,
          'app/root.tsx',
        ),
      ]),
    ).toEqual([])
  })

  test('evaluates only static CSP header values and ignores commented examples', () => {
    expect(
      scanStaticFrameAncestors([
        source(`headers.set('Content-Security-Policy', policy); const example = 'frame-ancestors *'`, 'app/root.tsx'),
      ]),
    ).toEqual([])
    expect(scanStaticFrameAncestors([source(`const note = 'frame-ancestors *'`, 'app/root.tsx')])).toEqual([])
    expect(
      scanStaticFrameAncestors([
        source(`const safe = true;// const headers = {'Content-Security-Policy': 'frame-ancestors *'}`, 'app/root.tsx'),
      ]),
    ).toEqual([])
  })

  test('covers static header setters, concatenation, templates, and mixed source lists', () => {
    expect(
      scanStaticFrameAncestors([
        source(`headers.set('Content-Security-Policy', 'frame-ancestors *')`, 'app/root.tsx'),
        source(`response.headers.append('Content-Security-Policy', 'frame-ancestors *')`, 'app/response.tsx'),
        source(`res.setHeader('Content-Security-Policy', 'frame-ancestors *')`, 'app/server.tsx'),
      ]),
    ).toHaveLength(3)
    expect(
      scanStaticFrameAncestors([
        source(`const headers = {'Content-Security-Policy': 'frame-ancestors ' + '*'}`, 'app/root.tsx'),
        source(`const headers = {'Content-Security-Policy': \`frame-ancestors *\`}`, 'app/template.tsx'),
        source(`const headers = {'Content-Security-Policy': "frame-ancestors 'self' *"}`, 'app/mixed.tsx'),
      ]),
    ).toHaveLength(3)
  })

  test('handles multiline and long static CSP literal construction', () => {
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {
  'Content-Security-Policy': [
    "default-src 'self';",
    'frame-ancestors *',
  ].join(' '),
}`,
          'app/root.tsx',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanStaticFrameAncestors([
        source(
          `const headers = {'Content-Security-Policy': "default-src ${'https://cdn.example.com '.repeat(40)}; frame-ancestors *"}`,
          'app/root.tsx',
        ),
      ]),
    ).toHaveLength(1)
  })

  test('consumes malformed string literals once', () => {
    const malformed = `const broken = "${'\\"'.repeat(64_000)}`

    expect(scanStaticFrameAncestors([source(malformed, 'app/broken.tsx')])).toEqual([])
  })
})

describe('Liquid AST mode', () => {
  test('uses context-appropriate output rules and reports parser failures', () => {
    expect(
      scanLiquidSecurity([source('{{ block.settings.title }}', 'extensions/theme/blocks/a.liquid')]).issues.map(
        (finding) => finding.id,
      ),
    ).toContain('LIQUID_UNSAFE_RENDER')
    expect(
      scanLiquidSecurity([source('{{ block.settings.title | escape }}', 'extensions/theme/blocks/a.liquid')]).issues,
    ).toHaveLength(0)
    expect(
      scanLiquidSecurity([
        source(
          '<script>const value = {{ product.metafields.app.value }};</script>',
          'extensions/theme/blocks/a.liquid',
        ),
      ]).issues.map((finding) => finding.id),
    ).toContain('UNSAFE_INNERHTML')
    expect(scanLiquidSecurity([source('{% if', 'extensions/theme/blocks/a.liquid')]).parserFailures).toEqual([
      'extensions/theme/blocks/a.liquid',
    ])
  })

  test('exempts schema-defined inert settings only in HTML text and non-URL attributes', () => {
    const schema = (settings: string) => `{% schema %}{"settings":[${settings}]}{% endschema %}`
    const select = schema('{"type":"select","id":"layout","options":[{"value":"left"},{"value":"right"}]}')
    const liquid = (content: string) =>
      scanLiquidSecurity([source(content, 'extensions/theme/blocks/a.liquid')]).issues.map((finding) => finding.id)
    // Inert select clean in text and non-URL attribute; escaped variants stay clean.
    expect(liquid(`{{ block.settings.layout }}${select}`)).not.toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<div class="{{ block.settings.layout }}"></div>${select}`)).not.toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`{{ block.settings.layout | escape }}${select}`)).not.toContain('LIQUID_UNSAFE_RENDER')
    // Checkbox and range clean.
    expect(liquid(`{{ block.settings.show }}${schema('{"type":"checkbox","id":"show"}')}`)).not.toContain(
      'LIQUID_UNSAFE_RENDER',
    )
    expect(liquid(`{{ block.settings.size }}${schema('{"type":"range","id":"size"}')}`)).not.toContain(
      'LIQUID_UNSAFE_RENDER',
    )
    // Bad option, free-text types, property access, JS/executable and URL contexts still flagged.
    expect(
      liquid(`{{ block.settings.layout }}${schema('{"type":"select","id":"layout","options":[{"value":"a<b"}]}')}`),
    ).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`{{ block.settings.title }}${schema('{"type":"text","id":"title"}')}`)).toContain(
      'LIQUID_UNSAFE_RENDER',
    )
    expect(liquid(`{{ block.settings.body }}${schema('{"type":"richtext","id":"body"}')}`)).toContain(
      'LIQUID_UNSAFE_RENDER',
    )
    expect(liquid(`{{ block.settings.layout.title }}${select}`)).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<script>const v = {{ block.settings.layout }};</script>${select}`)).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<div onclick="{{ block.settings.layout }}"></div>${select}`)).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<a href="{{ block.settings.layout }}">x</a>${select}`)).toContain('LIQUID_UNSAFE_RENDER')
    // Missing or unparseable schema stays flagged.
    expect(liquid('{{ block.settings.layout }}')).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid('{{ block.settings.layout }}{% schema %}not-json{% endschema %}')).toContain('LIQUID_UNSAFE_RENDER')
  })

  test('exempts only block settings in app block files, never the host section settings', () => {
    const schema = (settings: string) => `{% schema %}{"settings":[${settings}]}{% endschema %}`
    const range = schema('{"type":"range","id":"size"}')
    const select = schema('{"type":"select","id":"layout","options":[{"value":"left"},{"value":"right"}]}')
    const liquid = (content: string, path = 'extensions/theme/blocks/a.liquid') =>
      scanLiquidSecurity([source(content, path)]).issues.map((finding) => finding.id)

    expect(liquid(`{{ block.settings.layout }}${select}`)).not.toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`{{ block.settings.size }}${range}`)).not.toContain('LIQUID_UNSAFE_RENDER')
    // `section.settings` in an app block is the host section's, which this file's schema doesn't describe.
    expect(liquid(`{{ section.settings.size }}${range}`)).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<div class="{{ section.settings.layout }}"></div>${select}`)).toContain('LIQUID_UNSAFE_RENDER')
    // Outside app blocks, no setting is exempt.
    expect(liquid(`{{ block.settings.layout }}${select}`, 'extensions/theme/snippets/a.liquid')).toContain(
      'LIQUID_UNSAFE_RENDER',
    )
  })

  test('exempts filtered inert settings only through inert filters with inert literal arguments', () => {
    const schema = `{% schema %}{"settings":[{"type":"checkbox","id":"show"},{"type":"text","id":"title"}]}{% endschema %}`
    const liquid = (output: string) =>
      scanLiquidSecurity([source(`${output}${schema}`, 'extensions/theme/blocks/a.liquid')]).issues.map(
        (finding) => finding.id,
      )

    expect(liquid('{{ block.settings.show | downcase }}')).not.toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid('{{ block.settings.show | strip | upcase | handleize | capitalize }}')).not.toContain(
      'LIQUID_UNSAFE_RENDER',
    )
    expect(liquid("{{ block.settings.show | default: 'x' }}")).not.toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid("{{ block.settings.show | default: 'x', allow_false: true }}")).not.toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid('{{ block.settings.show | default: 3 }}')).not.toContain('LIQUID_UNSAFE_RENDER')
    // Filters that are not proven inert keep the finding, even with literal or no arguments.
    for (const filter of [
      'url_decode',
      'base64_decode',
      't',
      'script_tag',
      'stylesheet_tag',
      'img_tag',
      "link_to: 'x'",
      "replace: 'true', 'on'",
      "append: 'x'",
      'prepend: nil',
      "downcase: 'x'",
    ]) {
      expect(liquid(`{{ block.settings.show | ${filter} }}`)).toContain('LIQUID_UNSAFE_RENDER')
    }
    // A `default` fallback is rendered, so it must be an inert literal.
    expect(liquid("{{ block.settings.show | default: '<b>' }}")).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid("{{ block.settings.show | default: 'a b' }}")).toContain('LIQUID_UNSAFE_RENDER')
    // A setting or variable in any filter argument can render a free-text value.
    expect(liquid('{{ block.settings.show | default: block.settings.title }}')).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid('{{ block.settings.show | append: block.settings.title }}')).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid('{{ block.settings.show | prepend: section.settings.title }}')).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid("{{ block.settings.show | replace: 'true', block.settings.title }}")).toContain(
      'LIQUID_UNSAFE_RENDER',
    )
    expect(liquid('{{ block.settings.show | default: product.metafields.app.title }}')).toContain(
      'LIQUID_UNSAFE_RENDER',
    )
    expect(liquid('{{ block.settings.show | downcase | append: title }}')).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid("{{ block.settings.show | default: 'x', allow_false: title }}")).toContain('LIQUID_UNSAFE_RENDER')
  })

  test('keeps decoding and markup filters flagged for percent-encoded select values', () => {
    const schema = `{% schema %}{"settings":[{"type":"select","id":"layout","options":[{"value":"%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E"},{"value":"left"}]}]}{% endschema %}`
    const liquid = (output: string) =>
      scanLiquidSecurity([source(`${output}${schema}`, 'extensions/theme/blocks/a.liquid')]).issues.map(
        (finding) => finding.id,
      )

    // Percent-encoded text is inert until something decodes it.
    expect(liquid('{{ block.settings.layout }}')).not.toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid('{{ block.settings.layout | url_decode }}')).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid('{{ block.settings.layout | t }}')).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid('{{ block.settings.layout | script_tag }}')).toContain('LIQUID_UNSAFE_RENDER')
  })

  test('exempts inert settings only in quoted values of statically named inert attributes', () => {
    const schema =
      '{% schema %}{"settings":[{"type":"select","id":"layout","options":[{"value":"left"},{"value":"onclick"}]}]}{% endschema %}'
    const liquid = (content: string) =>
      scanLiquidSecurity([source(`${content}${schema}`, 'extensions/theme/blocks/a.liquid')]).issues.map(
        (finding) => finding.id,
      )
    const output = '{{ block.settings.layout }}'

    for (const attribute of ['class', 'id', 'title', 'alt', 'role', 'width', 'height', 'lang', 'dir', 'aria-label']) {
      expect(liquid(`<div ${attribute}="${output}"></div>`)).not.toContain('LIQUID_UNSAFE_RENDER')
    }
    expect(liquid(`<img alt='x ${output}'>`)).not.toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<p>{% if true %}${output}{% endif %}</p>`)).not.toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<div {% if true %}class="${output}"{% endif %}></div>`)).not.toContain('LIQUID_UNSAFE_RENDER')

    // URL, script, style, data-*, and unknown attributes keep the finding.
    for (const markup of [
      `<object data="${output}"></object>`,
      `<img srcset="${output}">`,
      `<link imagesrcset="${output}">`,
      `<img src="${output}">`,
      `<a href="${output}">x</a>`,
      `<button formaction="${output}"></button>`,
      `<form action="${output}"></form>`,
      `<video poster="${output}"></video>`,
      `<table background="${output}"></table>`,
      `<a ping="${output}">x</a>`,
      `<blockquote cite="${output}"></blockquote>`,
      `<svg><a xlink:href="${output}"></a></svg>`,
      `<object codebase="${output}"></object>`,
      `<html manifest="${output}"></html>`,
      `<iframe srcdoc="${output}"></iframe>`,
      `<div style="${output}"></div>`,
      `<div onclick="${output}"></div>`,
      `<div data-layout="${output}"></div>`,
      `<div x-layout="${output}"></div>`,
    ]) {
      expect(liquid(markup)).toContain('LIQUID_UNSAFE_RENDER')
    }

    // Output that can supply an attribute or tag name, unquoted values, and raw-text elements keep the finding.
    expect(liquid(`<button ${output}="alert(1)"></button>`)).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<div ${output}></div>`)).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<div {% if true %}${output}{% endif %}></div>`)).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<div data-${output}="1"></div>`)).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<div class=${output}></div>`)).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<${output}>x</${output}>`)).toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`<style>.a { color: ${output}; }</style>`)).toContain('LIQUID_UNSAFE_RENDER')
  })

  test('disables the exemption in files that rebind block', () => {
    const schema = '{% schema %}{"settings":[{"type":"range","id":"size"}]}{% endschema %}'
    const liquid = (content: string) =>
      scanLiquidSecurity([source(`${content}${schema}`, 'extensions/theme/blocks/a.liquid')]).issues.map(
        (finding) => finding.id,
      )
    const output = '{{ block.settings.size }}'

    expect(liquid(`{% assign item = section %}${output}`)).not.toContain('LIQUID_UNSAFE_RENDER')
    expect(liquid(`{% for item in section.blocks %}{% endfor %}${output}`)).not.toContain('LIQUID_UNSAFE_RENDER')

    for (const binding of [
      '{% assign block = section %}',
      '{% for block in section.blocks %}{% endfor %}',
      '{% tablerow block in section.blocks %}{% endtablerow %}',
      '{% capture block %}x{% endcapture %}',
      '{% increment block %}',
      '{% decrement block %}',
      '{% liquid\n  assign block = section\n%}',
    ]) {
      expect(liquid(`${binding}${output}`)).toContain('LIQUID_UNSAFE_RENDER')
      // The binding disables the exemption for the whole file, including output before it.
      expect(liquid(`${output}${binding}`)).toContain('LIQUID_UNSAFE_RENDER')
    }
    expect(liquid(`{% for block in section.blocks %}${output}{% endfor %}`)).toContain('LIQUID_UNSAFE_RENDER')
  })
})
