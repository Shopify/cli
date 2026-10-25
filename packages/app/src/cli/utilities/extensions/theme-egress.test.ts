import {allowedSourceFor, declaredAllowedSources, findOutboundOrigins, isOriginAllowed} from './theme-egress.js'
import {describe, expect, test} from 'vitest'

const scan = (path: string, content: string, allowedSources?: string[]) =>
  findOutboundOrigins([{path, content}], allowedSources).findings

const origins = (path: string, content: string, allowedSources?: string[]) =>
  scan(path, content, allowedSources)
    .filter((finding) => finding.status === 'undeclared')
    .map((finding) => finding.origin)

describe('findOutboundOrigins', () => {
  describe('Liquid', () => {
    test.each([
      ['<script src>', '<script src="https://a.example.com/app.js"></script>'],
      ['<link href>', '<link rel="stylesheet" href="https://a.example.com/app.css">'],
      ['<link href>', '<link rel="preconnect" href="https://a.example.com">'],
      ['<link href>', '<link rel="prefetch" href="https://a.example.com/next.js">'],
      ['<iframe src>', '<iframe src="https://a.example.com/embed"></iframe>'],
      ['<img src>', '<img src="https://a.example.com/pixel.gif">'],
      ['<source src>', '<video><source src="https://a.example.com/clip.mp4"></video>'],
      ['script_tag filter', "{{ 'https://a.example.com/app.js' | script_tag }}"],
      ['stylesheet_tag filter', "{{ 'https://a.example.com/app.css' | stylesheet_tag }}"],
    ])('finds %s', (sink, content) => {
      expect(scan('blocks/app.liquid', content)).toEqual([
        expect.objectContaining({
          kind: 'egress',
          status: 'undeclared',
          origin: 'https://a.example.com',
          sink,
          file: 'blocks/app.liquid',
          line: 1,
        }),
      ])
    })

    test('reports one-based line and column of the URL', () => {
      const content = '<div>\n  <script src="https://a.example.com/app.js"></script>\n</div>'
      expect(scan('snippets/app.liquid', content)).toEqual([expect.objectContaining({line: 2, column: 16})])
    })

    test('finds requests in inline scripts and styles', () => {
      const content = `<p>Hi</p>
<script>
  fetch('https://api.example.com/v1')
</script>
<style>@import "https://fonts.example.com/font.css";</style>`
      expect(scan('blocks/app.liquid', content)).toEqual([
        expect.objectContaining({origin: 'https://api.example.com', line: 3, column: 9, sink: 'fetch()'}),
        expect.objectContaining({origin: 'https://fonts.example.com', line: 5, sink: 'CSS @import'}),
      ])
    })

    test('ignores links that do not fetch', () => {
      expect(scan('blocks/app.liquid', '<link rel="canonical" href="https://a.example.com/page">')).toEqual([])
    })

    test('keeps a literal origin before a dynamic path', () => {
      expect(origins('blocks/app.liquid', '<img src="https://img.example.com/{{ block.settings.id }}.png">')).toEqual([
        'https://img.example.com',
      ])
    })

    test('reports URLs built in Liquid as dynamic', () => {
      expect(scan('blocks/app.liquid', '<script src="{{ block.settings.script_url }}"></script>')).toEqual([
        expect.objectContaining({kind: 'egress', status: 'dynamic', sink: '<script src>'}),
      ])
      expect(scan('blocks/app.liquid', '<img src="https://{{ block.settings.host }}/x.png">')).toEqual([
        expect.objectContaining({status: 'dynamic'}),
      ])
    })

    test('ignores asset_url and other Shopify URL filters, shop URLs and relative URLs', () => {
      const content = `<script src="{{ 'app.js' | asset_url }}" defer></script>
{{ 'app.css' | asset_url | stylesheet_tag }}
<img src="{{ product.featured_image | image_url: width: 200 }}">
<img src="{{ 'icon.svg' | shopify_asset_url }}">
<iframe src="{{ routes.root_url }}apps/proxy"></iframe>
<script src="/apps/proxy/widget.js"></script>
<img src="data:image/gif;base64,R0lGOD">`
      expect(scan('blocks/app.liquid', content)).toEqual([])
    })

    test('reports files the parser cannot read', () => {
      expect(findOutboundOrigins([{path: 'blocks/broken.liquid', content: '{% if %}<div'}])).toEqual({
        findings: [],
        parserFailures: ['blocks/broken.liquid'],
      })
    })
  })

  describe('JavaScript', () => {
    test.each([
      ['fetch()', "fetch('https://a.example.com/v1')"],
      ['XMLHttpRequest.open()', "xhr.open('POST', 'https://a.example.com/v1')"],
      ['new WebSocket()', "new WebSocket('wss://a.example.com/socket')"],
      ['new EventSource()', 'new EventSource("https://a.example.com/events")'],
      ['navigator.sendBeacon()', 'navigator.sendBeacon(`https://a.example.com/collect`, data)'],
      ['import()', "await import('https://a.example.com/module.js')"],
      ['new URL()', "const url = new URL('https://a.example.com/path')"],
    ])('finds %s', (sink, content) => {
      const expectedOrigin = sink === 'new WebSocket()' ? 'wss://a.example.com' : 'https://a.example.com'
      expect(scan('assets/app.js', content)).toEqual([
        expect.objectContaining({kind: 'egress', status: 'undeclared', origin: expectedOrigin, sink}),
      ])
    })

    test('reports runtime URLs as dynamic', () => {
      expect(scan('assets/app.js', 'fetch(endpoint)')).toEqual([expect.objectContaining({status: 'dynamic'})])
      // eslint-disable-next-line no-template-curly-in-string
      expect(scan('assets/app.js', 'fetch(`https://${host}/v1`)')).toEqual([
        expect.objectContaining({status: 'dynamic'}),
      ])
      expect(scan('assets/app.js', "fetch('https://' + host + '/v1')")).toEqual([
        expect.objectContaining({status: 'dynamic'}),
      ])
    })

    test('keeps a literal origin before a dynamic path', () => {
      // eslint-disable-next-line no-template-curly-in-string
      expect(origins('assets/app.js', 'fetch(`https://api.example.com/v1/${id}`)')).toEqual(['https://api.example.com'])
      expect(origins('assets/app.js', "fetch('https://api.example.com/v1/' + id)")).toEqual(['https://api.example.com'])
    })

    test('ignores relative URLs, the shop routes and non-literal new URL()', () => {
      const content = `fetch('/cart/add.js', {method: 'POST'})
fetch(\`/apps/proxy/\${id}\`)
fetch(window.Shopify.routes.root + 'cart.js')
fetch(location.origin + '/cart.js')
const url = new URL(path, window.location.origin)
import('./chunk.js')`
      expect(scan('assets/app.js', content)).toEqual([])
    })

    test('ignores comments', () => {
      expect(
        scan('assets/app.js', "// fetch('https://a.example.com')\n/* new WebSocket('wss://b.example.com') */"),
      ).toEqual([])
    })

    test('ignores shop URLs rendered by Liquid in inline scripts', () => {
      expect(scan('blocks/app.liquid', "<script>fetch('{{ shop.url }}/cart.js')</script>")).toEqual([])
    })
  })

  describe('CSS', () => {
    test('finds url() and @import', () => {
      const content = `@import 'https://fonts.example.com/a.css';
.hero { background: url(https://img.example.com/hero.png); }
.icon { background: url("https://img.example.com/icon.svg"); }
.local { background: url(icon.svg); }
/* url(https://commented.example.com/x.png) */`
      expect(scan('assets/app.css', content)).toEqual([
        expect.objectContaining({origin: 'https://fonts.example.com', line: 1, sink: 'CSS @import'}),
        expect.objectContaining({origin: 'https://img.example.com', line: 2, column: 25, sink: 'CSS url()'}),
        expect.objectContaining({origin: 'https://img.example.com', line: 3, sink: 'CSS url()'}),
      ])
    })
  })

  describe('declared sources', () => {
    const content = `<script src="https://api.example.com/a.js"></script>
<script src="https://other.example.net/b.js"></script>`

    test('reports only origins that allowed_sources does not cover', () => {
      expect(origins('blocks/app.liquid', content, ['https://api.example.com'])).toEqual(['https://other.example.net'])
    })

    test('reports every external origin when nothing is declared', () => {
      expect(origins('blocks/app.liquid', content)).toEqual(['https://api.example.com', 'https://other.example.net'])
    })

    test('reports nothing when every origin is declared', () => {
      expect(scan('blocks/app.liquid', content, ['https://api.example.com', 'https://other.example.net'])).toEqual([])
    })

    test('always reports http and ws origins', () => {
      const insecure = "fetch('http://api.example.com/v1'); new WebSocket('ws://api.example.com')"
      expect(scan('assets/app.js', insecure, ['https://api.example.com'])).toEqual([
        expect.objectContaining({origin: 'http://api.example.com', insecure: true}),
        expect.objectContaining({origin: 'ws://api.example.com', insecure: true}),
      ])
    })

    test('ignores Shopify-owned hosts', () => {
      const shopify = `<script src="https://cdn.shopify.com/s/app.js"></script>
<img src="https://shopify.com/logo.png">
<script>fetch('https://my-shop.myshopify.com/cart.js')</script>`
      expect(scan('blocks/app.liquid', shopify, [])).toEqual([])
    })
  })

  test('classifies navigation sinks separately from egress', () => {
    const liquid = `<a href="https://nav.example.com/page">Go</a>
<form action="https://forms.example.com/submit"></form>`
    const javascript = `location.href = 'https://nav.example.com/a'
window.location.assign('https://nav.example.com/b')
location.replace(next)
window.open('https://nav.example.com/c')`
    const findings = findOutboundOrigins(
      [
        {path: 'blocks/app.liquid', content: liquid},
        {path: 'assets/app.js', content: javascript},
      ],
      [],
    ).findings
    expect(findings.map(({kind, status, sink, origin}) => ({kind, status, sink, origin}))).toEqual([
      {kind: 'navigation', status: 'undeclared', sink: 'location.href', origin: 'https://nav.example.com'},
      {kind: 'navigation', status: 'undeclared', sink: 'location.assign()', origin: 'https://nav.example.com'},
      {kind: 'navigation', status: 'dynamic', sink: 'location.replace()', origin: undefined},
      {kind: 'navigation', status: 'undeclared', sink: 'window.open()', origin: 'https://nav.example.com'},
      {kind: 'navigation', status: 'undeclared', sink: '<a href>', origin: 'https://nav.example.com'},
      {kind: 'navigation', status: 'undeclared', sink: '<form action>', origin: 'https://forms.example.com'},
    ])
  })
})

describe('isOriginAllowed', () => {
  test('matches exact origins case-insensitively', () => {
    expect(isOriginAllowed('https://API.Example.com/v1', ['https://api.example.com'])).toBe(true)
    expect(isOriginAllowed('https://api.example.com', ['HTTPS://API.EXAMPLE.COM/'])).toBe(true)
    expect(isOriginAllowed('https://www.example.com', ['https://api.example.com'])).toBe(false)
  })

  test('matches one or more subdomain labels for a leading wildcard, but not the bare domain', () => {
    const allowed = ['https://*.cdn.example.com']
    expect(isOriginAllowed('https://a.cdn.example.com', allowed)).toBe(true)
    expect(isOriginAllowed('https://a.b.cdn.example.com', allowed)).toBe(true)
    expect(isOriginAllowed('https://cdn.example.com', allowed)).toBe(false)
    expect(isOriginAllowed('https://evilcdn.example.com', allowed)).toBe(false)
  })

  test('normalizes :443 and requires other ports to match', () => {
    expect(isOriginAllowed('https://api.example.com:443', ['https://api.example.com'])).toBe(true)
    expect(isOriginAllowed('https://api.example.com', ['https://api.example.com:443'])).toBe(true)
    expect(isOriginAllowed('https://api.example.com:8443', ['https://api.example.com'])).toBe(false)
    expect(isOriginAllowed('https://api.example.com:8443', ['https://api.example.com:8443'])).toBe(true)
  })

  test('matches wss like https and never matches http or ws', () => {
    expect(isOriginAllowed('wss://api.example.com', ['https://api.example.com'])).toBe(true)
    expect(isOriginAllowed('http://api.example.com', ['https://api.example.com'])).toBe(false)
    expect(isOriginAllowed('ws://api.example.com', ['https://api.example.com'])).toBe(false)
  })

  test('ignores invalid entries', () => {
    expect(isOriginAllowed('https://api.example.com', ['http://api.example.com', 'api.example.com'])).toBe(false)
  })
})

describe('allowedSourceFor', () => {
  test('gives the HTTPS entry that covers an origin', () => {
    expect(allowedSourceFor('https://api.example.com')).toBe('https://api.example.com')
    expect(allowedSourceFor('wss://realtime.example.com')).toBe('https://realtime.example.com')
    expect(allowedSourceFor('wss://realtime.example.com:8443')).toBe('https://realtime.example.com:8443')
  })

  test('returns undefined for origins that cannot be declared', () => {
    expect(allowedSourceFor('http://api.example.com')).toBeUndefined()
    expect(allowedSourceFor('ws://api.example.com')).toBeUndefined()
  })
})

describe('declaredAllowedSources', () => {
  test('reads allowed_sources from a network_access table', () => {
    expect(declaredAllowedSources({network_access: {allowed_sources: ['https://a.example.com']}})).toEqual([
      'https://a.example.com',
    ])
    expect(declaredAllowedSources({network_access: {allowed_sources: []}})).toEqual([])
  })

  test('returns undefined when nothing is declared', () => {
    expect(declaredAllowedSources(undefined)).toBeUndefined()
    expect(declaredAllowedSources({network_access: true})).toBeUndefined()
    expect(declaredAllowedSources({network_access: {}})).toBeUndefined()
  })
})
