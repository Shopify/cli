import {scanStorefrontCspCompatibility, type StorefrontCspInput} from '../rules/storefront-csp-compatibility.js'
import {describe, expect, test} from 'vitest'

function scan(content: string, ext = '.js') {
  return scanSource(content, ext).issues
}

function scanSource(
  content: string | undefined,
  ext = '.js',
  appConfig: StorefrontCspInput['appConfig'] = noAppSources,
) {
  return scanStorefrontCspCompatibility({
    files: [{path: `extensions/theme/assets/widget${ext}`, absolutePath: `/widget${ext}`, ext, content}],
    appConfig,
    extensionConfigs: [],
  })
}

const noAppSources: StorefrontCspInput['appConfig'] = {
  path: 'shopify.app.toml',
  content: 'name = "app"\n',
  raw: {name: 'app'},
}

function appConfigWith(allowedSources: unknown[]): NonNullable<StorefrontCspInput['appConfig']> {
  const lines = allowedSources.map((source) => `  ${JSON.stringify(source)},`).join('\n')
  return {
    path: 'shopify.app.toml',
    content: `name = "app"\n\n[network_access]\nallowed_sources = [\n${lines}\n]\n`,
    raw: {name: 'app', network_access: {allowed_sources: allowedSources}},
  }
}

describe('storefront runtime code generation', () => {
  test.each([
    'eval("render()")',
    'window.eval("render()")',
    'globalThis["eval"]("render()")',
    '(0, eval)("render()")',
    'Function("return 1")',
    'new Function("value", "return value")',
    'self.Function("return 1")',
    '(async function() {}).constructor("return 1")',
    '(function*() {}).constructor("yield 1")',
    '(async function*() {}).constructor("yield 1")',
    '(() => {}).constructor("return 1")',
    'Object.getPrototypeOf(async function() {}).constructor("return 1")',
    'Reflect.getPrototypeOf(function*() {}).constructor("yield 1")',
    '(() => {}).constructor.constructor("return 1")',
    'const run = window.eval; run("render()")',
    'const AsyncFunction = (async function() {}).constructor; new AsyncFunction("return 1")',
    'const {eval: run} = window; run("render()")',
    'setTimeout("render()", 1)',
    'window.setInterval("render()", 1)',
    'setTimeout("render(" + value + ")", 1)',
    'const callback = "render()"; setTimeout(callback, 1)',
    ['const output = `result $', '{eval("1")}`'].join(''),
    ['const output = `result $', '{new Function("return 1")()}`'].join(''),
    'eval?.("render()")',
  ])('finds %s', (content) => {
    expect(scan(content)).toHaveLength(1)
  })

  test.each([
    '// eval("render()")\nrender()',
    'const example = \'eval("render()")\'',
    'const example = \'setTimeout("render()", 1)\'',
    'const example = `setInterval("render()", 1)`',
    'const pattern = /eval\\(code\\)/',
    'function renderFunction() { return 1; } renderFunction()',
    'widget.Function(value)',
    'widget . eval(value)',
    'function render(Function) { return Function("value") }',
    'import {eval as run} from "expression-parser"; run("1")',
    'const window = {eval: render}; window.eval("1")',
    'setTimeout(() => render(), 1)',
    'const callback = () => render(); setInterval(callback, 1)',
    'eval(42)',
    'eval()',
  ])('does not flag %s', (content) => {
    expect(scan(content)).toEqual([])
  })

  test.each([
    '{% javascript %}eval("1");{% endjavascript %}',
    '{%- javascript -%}eval("1");{%- endjavascript -%}',
    '<script>eval("1")</script>',
    '<script type="module">eval("1")</script>',
    '<script type="text/javascript">eval("1")</script>',
    '<script type="text/jscript">eval("1")</script>',
    '<script type="text/livescript">eval("1")</script>',
  ])('finds executable Liquid JavaScript: %s', (content) => {
    expect(scan(content, '.liquid')).toHaveLength(1)
  })

  test.each([
    '{% comment %}<script>eval("1")</script>{% endcomment %}',
    '<!-- <script>eval("1")</script> -->',
    '<script type="application/json">{"example":"setTimeout(\'render()\', 1)"}</script>',
    '<script TYPE="text/plain">eval("1")</script>',
    '<script type="text/x-template">eval("1")</script>',
    '<script src="/assets/widget.js">eval("1")</script>',
    '<script src="{{ "widget.js" | asset_url }}">Function("return 1")</script>',
  ])('ignores inert Liquid content: %s', (content) => {
    expect(scan(content, '.liquid')).toEqual([])
  })

  test.each([
    ['.ts', 'const run: typeof eval = eval; run("1")'],
    ['.tsx', 'const view = <div>{eval("1")}</div>'],
    ['.jsx', 'const view = <div>{eval("1")}</div>'],
    ['.mjs', 'export const result = eval("1")'],
    ['.cjs', 'module.exports = eval("1")'],
    ['.mts', 'export const result: unknown = eval("1")'],
    ['.cts', 'const result: unknown = eval("1")'],
  ])('parses %s source', (ext, content) => {
    expect(scan(content, ext)).toHaveLength(1)
  })

  test('resolves aliases in their declaration scope', () => {
    const issues = scan('const run = eval; function render(eval) { run("1"); eval("1") } eval("1")')
    expect(issues).toHaveLength(2)
  })

  test.each([
    'let run = eval; run = custom; run("1")',
    'const run = external; run("1")',
    'const first = second; const second = first; first("1")',
    'eval(code)',
    'setTimeout(callback, 1)',
  ])('leaves ambiguous code for semantic review: %s', (content) => {
    expect(scanSource(content)).toMatchObject({
      issues: [],
      unresolvedReasonCode: 'agent_investigation_required',
    })
  })

  test('retains both findings on a minified line', () => {
    expect(scan('eval("1");eval("2")').map((issue) => issue.location)).toEqual([
      {file: 'extensions/theme/assets/widget.js', line: 1, column: 1},
      {file: 'extensions/theme/assets/widget.js', line: 1, column: 11},
    ])
  })

  test('reports original Liquid locations across scripts and Unicode', () => {
    const source =
      '<p>🌎</p>\n<script>eval("1")</script>\n{% javascript %}\n  Function("return 1")\n{% endjavascript %}'
    expect(scan(source, '.liquid').map((issue) => issue.location)).toEqual([
      {file: 'extensions/theme/assets/widget.liquid', line: 2, column: 9},
      {file: 'extensions/theme/assets/widget.liquid', line: 4, column: 3},
    ])
  })

  test('reports an ambiguous argument at its original Liquid line', () => {
    expect(scanSource('<p>text</p>\n<script>\neval(code)\n</script>', '.liquid').unresolvedReason).toContain(
      'widget.liquid:3: eval argument needs review',
    )
  })

  test.each([
    ['.js', 'eval('],
    ['.liquid', '<script>eval("1")'],
    ['.liquid', '{% javascript %}eval("1")'],
    ['.html', '<script>eval("1")</script foo>'],
    ['.html', '<script>eval("1")</script/>'],
  ])('leaves unparsable %s source unresolved', (ext, content) => {
    expect(scanSource(content, ext)).toMatchObject({
      issues: [],
      unresolvedReasonCode: 'agent_investigation_required',
      unresolvedReason: expect.stringContaining('could not be parsed'),
    })
  })

  test('leaves a Liquid-dependent script type unresolved', () => {
    expect(scanSource('<script type="{{ script_type }}">eval("1")</script>', '.liquid')).toMatchObject({
      issues: [],
      unresolvedReason: expect.stringContaining('dynamic script type needs review'),
    })
  })

  test.each(['new eval("1")', 'new window.setTimeout("1", 1)'])('ignores non-constructible %s', (content) => {
    expect(scan(content)).toEqual([])
  })

  test('does not mark unreadable source as inspected', () => {
    expect(scanSource(undefined)).toMatchObject({
      issues: [],
      inspectedFiles: [],
      unresolvedReason: expect.stringContaining('source was not readable'),
    })
  })

  test.each(['eval("1")', 'render()', ''])('requires production review even after parsing %s', (content) => {
    expect(scanSource(content)).toMatchObject({
      inspectedFiles: ['extensions/theme/assets/widget.js'],
      unresolvedReasonCode: 'agent_investigation_required',
    })
  })
})

describe('storefront remote origins', () => {
  const origins = (content: string, ext = '.js', appConfig = noAppSources) =>
    scanSource(content, ext, appConfig).issues.map((issue) => [issue.pattern_id, issue.message])

  test.each([
    ['.js', 'fetch("https://api.example.com/reviews")', 'https://api.example.com (connect-src)'],
    [
      '.js',
      ['window.fetch(`https://api.example.com/reviews/$', '{id}`)'].join(''),
      'https://api.example.com (connect-src)',
    ],
    ['.js', 'const base = "https://api.example.com/"; fetch(base + path)', 'https://api.example.com (connect-src)'],
    ['.js', 'new WebSocket("wss://socket.example.com/live")', 'wss://socket.example.com (connect-src)'],
    ['.js', 'new EventSource("https://events.example.com/stream")', 'https://events.example.com (connect-src)'],
    ['.js', 'navigator.sendBeacon("https://beacon.example.com/hit", data)', 'https://beacon.example.com'],
    ['.js', 'xhr.open("POST", "https://api.example.com:8443/x")', 'https://api.example.com:8443 (connect-src)'],
    ['.js', 'import("https://cdn.example.com/module.js")', 'https://cdn.example.com (script-src)'],
    ['.mjs', 'import {render} from "https://cdn.example.com/module.js"', 'https://cdn.example.com (script-src)'],
    [
      '.js',
      'const script = document.createElement("script"); script.src = "https://cdn.example.com/a.js"',
      'https://cdn.example.com (script-src)',
    ],
    ['.liquid', '<script src="https://cdn.example.com/a.js"></script>', 'https://cdn.example.com (script-src)'],
    ['.liquid', '<img src="//images.example.com/a.png">', 'https://images.example.com (img-src)'],
    ['.liquid', '<img srcset="/a.png 1x, https://images.example.com/a@2x.png 2x">', 'https://images.example.com'],
    ['.liquid', '<iframe src="https://jplhomer.org/embed"></iframe>', 'https://jplhomer.org (frame-src)'],
    ['.liquid', '<link rel="stylesheet" href="https://styles.example.com/a.css">', 'https://styles.example.com'],
    ['.liquid', '<link rel="preload" as="font" href="https://fonts.example.com/a.woff2">', '(font-src)'],
    [
      '.liquid',
      '{% stylesheet %}@import url("https://styles.example.com/a.css");{% endstylesheet %}',
      'https://styles.example.com (style-src)',
    ],
    ['.liquid', '<style>.a { background: url(https://images.example.com/a.png) }</style>', '(img-src)'],
    [
      '.liquid',
      '{% stylesheet %}@font-face { src: url("https://fonts.example.com/a.woff2") }{% endstylesheet %}',
      'https://fonts.example.com (font-src)',
    ],
  ])('reports an undeclared origin in %s: %s', (ext, content, expected) => {
    expect(origins(content, ext)).toEqual([['undeclared_origin', expect.stringContaining(expected)]])
  })

  test('suggests the allowed_sources entry for an undeclared origin', () => {
    expect(scan('fetch("https://api.example.com/reviews")')).toMatchObject([
      {
        id: 'STOREFRONT_CSP_COMPATIBILITY',
        severity: 'medium',
        confidence: 'needs_review',
        location: {file: 'extensions/theme/assets/widget.js', line: 1, column: 1},
        fix: {
          description: expect.stringContaining('Add "https://api.example.com" to [network_access] allowed_sources'),
        },
      },
    ])
  })

  test.each([
    ['fetch("https://api.example.com/x")', ['https://api.example.com']],
    ['fetch("https://api.example.com/x")', ['https://API.example.com/']],
    ['fetch("https://eu.api.example.com/x")', ['https://*.api.example.com']],
    ['fetch("https://api.example.com:8443/x")', ['https://api.example.com:8443']],
    ['new WebSocket("wss://socket.example.com")', ['https://socket.example.com']],
  ])('accepts %s declared as %j', (content, allowedSources) => {
    expect(origins(content, '.js', appConfigWith(allowedSources))).toEqual([])
  })

  test.each([
    ['fetch("https://api.example.com/x")', ['https://*.api.example.com']],
    ['fetch("https://api.example.com:8443/x")', ['https://api.example.com']],
    ['fetch("https://other.example.com/x")', ['https://api.example.com']],
  ])('still reports %s declared as %j', (content, allowedSources) => {
    expect(origins(content, '.js', appConfigWith(allowedSources))).toEqual([['undeclared_origin', expect.any(String)]])
  })

  test.each([
    ['.liquid', '<script src="https://cdn.shopify.com/s/files/a.js"></script>'],
    ['.liquid', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">'],
    ['.liquid', '{% stylesheet %}@font-face { src: url(https://fonts.gstatic.com/a.woff2) }{% endstylesheet %}'],
    ['.liquid', '<iframe src="https://shop.app/pay"></iframe>'],
    ['.js', 'fetch("https://monorail-edge.shopifysvc.com/v1/produce")'],
    ['.liquid', '<script src="{{ \'widget.js\' | asset_url }}"></script>'],
    ['.liquid', '<img src="{{ block.settings.image | image_url: width: 400 }}">'],
    ['.liquid', '<img src="data:image/png;base64,AAAA">'],
    ['.js', 'fetch("/apps/reviews/list")'],
    ['.js', ['fetch(`/apps/reviews/$', '{id}`)'].join('')],
    ['.liquid', '<a href="https://jplhomer.org">Navigation is not a fetch</a>'],
    ['.liquid', '<link rel="preconnect" href="https://api.example.com">'],
    ['.liquid', '{% comment %}<script src="https://cdn.example.com/a.js"></script>{% endcomment %}'],
    ['.js', 'const example = "fetch(\'https://api.example.com\')"'],
  ])('does not report allowed or non-fetch URLs in %s: %s', (ext, content) => {
    expect(origins(content, ext)).toEqual([])
  })

  test('never asks to declare a Shopify domain', () => {
    const result = scanSource(
      'fetch("https://example.myshopify.com/cart.js"); fetch("https://checkout.shopify.com/x"); new Image().src = "https://shop.app/x"',
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toContain('https://example.myshopify.com is a Shopify domain')
  })

  test('reports insecure origins even when the host is declared', () => {
    expect(
      origins(
        '<script src="http://cdn.example.com/a.js"></script>',
        '.liquid',
        appConfigWith(['https://cdn.example.com']),
      ),
    ).toEqual([['insecure_origin', expect.stringContaining('allows only HTTPS origins')]])
  })

  test.each([
    ['fetch(endpoint)', 'widget.js:1: A fetch request URL is computed'],
    [['fetch(`$', '{base}/reviews`)'].join(''), 'widget.js:1: A fetch request URL is computed'],
    ['new WebSocket(settings.url)', 'widget.js:1: A WebSocket URL is computed'],
  ])('leaves computed URLs for the agent: %s', (content, reason) => {
    expect(scanSource(content)).toMatchObject({issues: [], unresolvedReason: expect.stringContaining(reason)})
  })

  test('leaves a Liquid-computed src for the agent', () => {
    expect(scanSource('<script src="{{ block.settings.script_url }}"></script>', '.liquid')).toMatchObject({
      issues: [],
      unresolvedReason: expect.stringContaining('A <script src> URL is computed'),
    })
  })

  test('reports each origin once per file and directive', () => {
    expect(scan('fetch("https://api.example.com/a"); fetch("https://api.example.com/b")')).toHaveLength(1)
  })

  test('leaves origins unresolved without a readable app configuration', () => {
    expect(scanSource('fetch("https://api.example.com/a")', '.js', null)).toMatchObject({
      issues: [],
      unresolvedReason: expect.stringContaining('could not be compared with [network_access] allowed_sources'),
    })
  })
})

describe('storefront allowed_sources', () => {
  test.each([
    ['http://api.example.com', 'is not an HTTPS origin'],
    ['https://api.example.com/path', 'is not an HTTPS origin'],
    ['https://*', 'does not name a DNS host'],
    ['https://127.0.0.1', 'does not name a DNS host'],
    ['https://api.example.com:443', 'default HTTPS port'],
    ['https://cdn.shopify.com', "names a Shopify domain, which apps can't declare"],
    ['https://*.myshopify.com', "names a Shopify domain, which apps can't declare"],
    [42, 'is not a string'],
  ])('reports %j as ignored by the storefront', (source, reason) => {
    const appConfig = appConfigWith([source])
    expect(scanSource('', '.js', appConfig).issues).toEqual([
      expect.objectContaining({
        pattern_id: 'invalid_allowed_source',
        severity: 'low',
        confidence: 'definite',
        message: expect.stringContaining(reason),
        location: {file: 'shopify.app.toml', line: 5},
      }),
    ])
  })

  test('reports entries past the storefront limit', () => {
    const sources = Array.from({length: 21}, (_, index) => `https://host${index}.example.com`)
    expect(scanSource('', '.js', appConfigWith(sources)).issues).toEqual([
      expect.objectContaining({message: expect.stringContaining('"https://host20.example.com" is past the first 20')}),
    ])
  })

  test('reports allowed_sources declared in a theme app extension', () => {
    const result = scanStorefrontCspCompatibility({
      files: [],
      appConfig: noAppSources,
      extensionConfigs: [
        {
          path: 'extensions/theme/shopify.extension.toml',
          content: 'type = "theme"\n\n[capabilities.network_access]\nallowed_sources = ["https://api.example.com"]\n',
        },
      ],
    })
    expect(result.issues).toEqual([
      expect.objectContaining({
        pattern_id: 'extension_allowed_sources',
        location: {file: 'extensions/theme/shopify.extension.toml', line: 4},
        fix: expect.objectContaining({description: expect.stringContaining('shopify.app.toml')}),
      }),
    ])
  })

  test('accepts valid entries without findings', () => {
    expect(
      scanSource(
        '',
        '.js',
        appConfigWith(['https://api.example.com', 'https://*.jplhomer.org', 'https://a.example.com:8443']),
      ).issues,
    ).toEqual([])
  })
})
