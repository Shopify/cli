import {scanEolApiVersions, isEolApiVersion} from '../rules/compliance-rules.js'
import {
  scanCredentialBrowserLeakage,
  scanCredentialLogLeakage,
  scanRequestControlledAdminContext,
  scanUnsafeInnerHTML,
} from '../rules/js-rules.js'
import {scanLiquidSecurity} from '../rules/liquid-rules.js'
import {scanDeprecatedScriptTagApi} from '../rules/shopify-rules.js'
import {scanAppProxyLiquidInjection} from '../rules/proxy-rules.js'
import {scanExpiringOfflineTokens} from '../rules/token-rules.js'
import {extname} from '@shopify/cli-kit/node/path'
import {describe, expect, test} from 'vitest'
import type {ScanContext, SourceFile} from '../rules/types.js'

const source = (content: string, path = 'app/routes/example.tsx'): SourceFile => ({
  path,
  absolutePath: `/${path}`,
  ext: extname(path),
  content,
})

function context(
  input: {
    files?: SourceFile[]
    appTomls?: ScanContext['appTomls']
    framework?: ScanContext['detection']['framework']
  } = {},
): ScanContext {
  const appTomls = input.appTomls ?? []
  return {
    appRoot: '/app',
    appToml: appTomls[0] ?? null,
    appTomls,
    extensions: [],
    sourceFiles: input.files ?? [],
    manifests: [],
    dependencyAuditing: {files: []},
    sensitiveFiles: [],
    capabilities: {
      theme_app_extension: false,
      app_embed: false,
      embedded_app: false,
      script_tags: false,
      webhooks: false,
      app_proxy: false,
      storefront_metafield_writes: false,
      has_backend: true,
      declared_ip_allowlist: false,
      checkout_extension: false,
    },
    detection: {framework: input.framework ?? 'react_router', surface: 'react_router', languages: []},
    sourceCandidates: [],
  }
}

describe('REQUEST_CONTROLLED_ADMIN_CONTEXT trust provenance', () => {
  test('flags direct, destructured, and multiline request values even after authentication', () => {
    const findings = scanRequestControlledAdminContext([
      source(`export const action = async ({request}) => {
  const {session} = await authenticate.admin(request);
  const formData = await request.formData();
  const requestedShop =
    formData.get("shop");
  await unauthenticated.admin(
    requestedShop,
  );
  const {shopDomain: jsonShop} = await request.json();
  await unauthenticated.admin(jsonShop);
  await unauthenticated.admin(request.query.shop);
  return session.shop;
}`),
    ])

    expect(findings).toHaveLength(3)
    expect(findings.map((finding) => finding.location.line)).toEqual([6, 10, 11])
  })

  test('trusts only shops actually derived from authentication/session output', () => {
    const findings = scanRequestControlledAdminContext([
      source(`export const loader = async ({request}) => {
  const authenticated = await authenticate.admin(request);
  await unauthenticated.admin(authenticated.session.shop);
  const {session} = authenticated;
  const {shop} = session;
  await unauthenticated.admin(shop);
  // unauthenticated.admin(request.query.shop)
  return "unauthenticated.admin(formData.get('shop'))";
}`),
    ])

    expect(findings).toEqual([])
  })

  test('follows typed one-hop request parsing helpers and inline helper member reads', () => {
    const findings = scanRequestControlledAdminContext([
      source(`function readParams(request: Request): {shop: string} {
  const url = new URL(request.url);
  return {shop: url.searchParams.get("shop") ?? ""};
}

export const loader = async ({request}) => {
  const params = readParams(request);
  await unauthenticated.admin(params.shop);
  await unauthenticated.admin(readParams(request).shop);
  await unauthenticated.admin((await readParams(request)).shop);
}`),
    ])

    expect(findings).toHaveLength(3)
    expect(findings.map((finding) => finding.location.line)).toEqual([8, 9, 10])
  })

  test('follows request parsing helpers with additional arguments', () => {
    const findings = scanRequestControlledAdminContext([
      source(`function readParams(request: Request, context: AppLoadContext): {shop: string} {
  return {shop: new URL(request.url).searchParams.get("shop") ?? ""};
}

export const loader = async ({request, context}) => {
  const params = readParams(request, context);
  await unauthenticated.admin(params.shop);
  await unauthenticated.admin(readParams(request, context).shop);
}`),
    ])

    expect(findings).toHaveLength(2)
    expect(findings.map((finding) => finding.location.line)).toEqual([7, 8])
  })

  test('does not taint trusted session properties or helpers that return a rebound session shop', () => {
    const findings = scanRequestControlledAdminContext([
      source(`export const loader = async ({request}) => {
  const {shop} = request.query;
  const authenticated = await authenticate.admin(request);
  await unauthenticated.admin(authenticated.session.shop);
  function readParams(request: Request): {shop: string} {
    const url = new URL(request.url);
    const requestedShop = url.searchParams.get("shop") ?? "";
    if (requestedShop !== authenticated.session.shop) throw new Error("invalid shop");
    return {shop: authenticated.session.shop};
  }
  const params = readParams(request);
  await unauthenticated.admin(params.shop);
}`),
    ])

    expect(findings).toEqual([])
  })
})

describe('APP_PROXY_LIQUID_INJECTION body flow', () => {
  test('flags request data only in the same active Response body', () => {
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}) => {
  const shop = request.query.shop;
  return new Response(\`<div>\${shop}</div>\`, {headers: {'Content-Type': 'text/html'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}) => {
  const shop = request.query.shop;
  return new Response('<div>static</div>', {headers: {'Content-Type': 'text/html', 'X-Shop': shop}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toEqual([])
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}) => {
  const shop = request.query.shop;
  const session = {shop: 'trusted'};
  return new Response(\`<div>\${session.shop}</div>\`, {headers: {'Content-Type': 'text/html'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toEqual([])
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}) => {
  const shop = request.query.shop;
  const html = new Response('<div>safe</div>', {headers: {'Content-Type': 'text/html'}});
  return new Response(JSON.stringify({shop}), {headers: {'Content-Type': 'application/json'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toEqual([])
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}) => {
  const shop = request.query
    .shop;
  return new Response(\`<a href="https://example.com/\${shop}">Shop</a>\`, {headers: {'Content-Type': 'text/html'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
  })

  test('follows post-declaration aliases and tuple-form Response headers', () => {
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}) => {
  let shop;
  shop = request.query.shop;
  return new Response(
    \`<div>\${shop}</div>\`,
    {headers: [['Content-Type', 'text/html']]},
  );
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
  })

  test('follows Express response setters and body sinks', () => {
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(\`<div>\${request.query.shop}</div>\`);
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}, res) => {
  res.type('html');
  res.end(\`<div>\${request.query.shop}</div>\`);
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}, res) => {
  res.set({'Content-Type': 'text/html'});
  res.write(\`<div>\${request.query.shop}</div>\`);
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(\`<div>\${request.query.shop}</div>\`);
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toEqual([])
  })

  test('suppresses only imported HTML escapers, never local identities or Liquid bodies', () => {
    expect(
      scanAppProxyLiquidInjection([
        source(
          `import escapeHtml from 'escape-html';
export const loader = ({request}) => {
  const shop = request.query.shop;
  return new Response(\`<div>\${escapeHtml(String(shop))}</div>\`, {headers: {'Content-Type': 'text/html'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toEqual([])
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}) => {
  function escapeHtml(value) { return value; }
  const shop = request.query.shop;
  return new Response(\`<div>\${escapeHtml(shop)}</div>\`, {headers: {'Content-Type': 'text/html'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanAppProxyLiquidInjection([
        source(
          `import escapeHtml from 'escape-html';
export const loader = ({request}) => {
  const shop = request.query.shop;
  return new Response(\`{{ \${escapeHtml(shop)} }}\`, {headers: {'Content-Type': 'application/liquid'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
  })

  test('does not suppress imported HTML escaping when earlier interpolation can change HTML context', () => {
    expect(
      scanAppProxyLiquidInjection([
        source(
          `import escapeHtml from 'escape-html';
export const loader = ({request}) => {
  const opening = '<script>';
  const closing = '</script>';
  return new Response(\`\${opening}\${escapeHtml(request.query.action)}\${closing}\`, {headers: {'Content-Type': 'text/html'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
  })

  test('does not trust a shadowed escape-html binding', () => {
    expect(
      scanAppProxyLiquidInjection([
        source(
          `import escapeHtml from 'escape-html';
export const loader = ({request}) => {
  const render = (escapeHtml) => new Response(\`<div>\${escapeHtml(request.query.shop)}</div>\`, {headers: {'Content-Type': 'text/html'}});
  return render((value) => value);
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
  })

  test('does not trust escape-html in method parameter scope', () => {
    expect(
      scanAppProxyLiquidInjection([
        source(
          `import escapeHtml from 'escape-html';
export const loader = ({request}) => {
  const renderer = {
    render(escapeHtml) {
      return new Response(\`<div>\${escapeHtml(request.query.shop)}</div>\`, {headers: {'Content-Type': 'text/html'}});
    },
  };
  return renderer.render((value) => value);
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
  })
  test('does not suppress imported HTML escaping in executable attribute or URL contexts', () => {
    expect(
      scanAppProxyLiquidInjection([
        source(
          `import escapeHtml from 'escape-html';
export const loader = ({request}) => {
  const action = request.query.action;
  return new Response(\`<button onclick="\${escapeHtml(action)}">Run</button>\`, {headers: {'Content-Type': 'text/html'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanAppProxyLiquidInjection([
        source(
          `import escapeHtml from 'escape-html';
export const loader = ({request}) => {
  const target = request.query.target;
  return new Response(\`<a href="\${escapeHtml(target)}">Open</a>\`, {headers: {'Content-Type': 'text/html'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanAppProxyLiquidInjection([
        source(
          `import escapeHtml from 'escape-html';
export const loader = ({request}) => {
  const action = request.query.action;
  return new Response(\`<button title="1 > 0" onclick="\${escapeHtml(action)}">Run</button>\`, {headers: {'Content-Type': 'text/html'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
  })

  test('parses only executable Response calls and handles regexes and nested templates', () => {
    expect(
      scanAppProxyLiquidInjection([
        source(
          `const example = "new Response(request.query.shop, {headers: {'Content-Type': 'text/html'}})"`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toEqual([])
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}) => {
  return new Response(request.query.shop.replace(/\\)/g, ''), {headers: {'Content-Type': 'text/html'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}) => {
  return new Response(\`\${request.query.shop ? \`<div>\${request.query.shop}</div>\` : ''}\`, {headers: {'Content-Type': 'text/html'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toHaveLength(1)
    expect(
      scanAppProxyLiquidInjection([
        source(
          `export const loader = ({request}) => {
  const shop = request.query.shop;
  return new Response(JSON.stringify({shop}), {headers: {'X-Content-Type': 'text/html', 'Content-Type': 'application/json'}});
}`,
          'app/routes/proxy.ts',
        ),
      ]),
    ).toEqual([])
  })
})

describe('string masking', () => {
  test('does not hang on unclosed template literals with repeated escapes', () => {
    const poison = `\`${'\\_'.repeat(40)}`

    expect(
      scanRequestControlledAdminContext([
        source(`${poison}
export const action = async ({request}) => {
  await unauthenticated.admin(request.query.shop);
}`),
      ]),
    ).toHaveLength(1)
    expect(scanUnsafeInnerHTML([source(`${poison}\nelement.innerHTML = payload`)])).toHaveLength(1)
    expect(
      scanEolApiVersions(
        context({
          files: [
            source(
              `${poison}\nexport default shopifyApp({apiVersion: ApiVersion.January24});`,
              'app/shopify.server.mts',
            ),
          ],
        }),
        new Date('2026-08-31T00:00:00.000Z'),
      ).map((finding) => finding.location.file),
    ).toEqual(['app/shopify.server.mts'])
  })
})

describe('EOL_API_VERSION quarterly lifecycle', () => {
  test('uses a 12-month window plus the documented 30-day extension grace', () => {
    expect(isEolApiVersion('2025-07', new Date('2026-07-30T00:00:00.000Z'))).toBe(false)
    expect(isEolApiVersion('2025-07', new Date('2026-07-31T00:00:00.000Z'))).toBe(true)
    expect(isEolApiVersion('2025-10', new Date('2026-08-31T00:00:00.000Z'))).toBe(false)
    expect(isEolApiVersion('unstable', new Date('2026-08-31T00:00:00.000Z'))).toBe(false)
  })

  test('checks every parsed TOML and high-signal React Router server declarations only', () => {
    const findings = scanEolApiVersions(
      context({
        appTomls: [
          {raw: {}, path: '/app/shopify.app.toml', apiVersion: '2025-04', redirectUrls: [], webhooks: []},
          {raw: {}, path: '/app/shopify.app.production.toml', apiVersion: '2025-07', redirectUrls: [], webhooks: []},
        ],
        files: [
          source(
            `export default shopifyApp({
  apiVersion:
    ApiVersion.April25,
});
// apiVersion: ApiVersion.January24`,
            'app/shopify.server.mts',
          ),
          source('const apiVersion = ApiVersion.January24', 'app/routes/example.mts'),
        ],
      }),
      new Date('2026-08-31T00:00:00.000Z'),
    )

    expect(findings.map((finding) => finding.location.file)).toEqual([
      'shopify.app.toml',
      'shopify.app.production.toml',
      'app/shopify.server.mts',
    ])
  })
})

describe('EXPIRING_OFFLINE_TOKEN supported React Router analysis', () => {
  test('reports explicit false but never treats isOnline false as disabling expiry', () => {
    const result = scanExpiringOfflineTokens(
      context({
        files: [
          source(
            `shopifyApp({
  future: {expiringOfflineAccessTokens: false},
  isOnline: false,
  sessionStorage: new MemorySessionStorage(),
})`,
            'app/shopify.server.ts',
          ),
        ],
      }),
    )
    expect(result.issues).toHaveLength(1)
    expect(result.unresolvedReason).toBeUndefined()
  })

  test('returns clean only when enablement and refresh-compatible storage are visible', () => {
    const memory = scanExpiringOfflineTokens(
      context({
        files: [
          source(
            'shopifyApp({future: {expiringOfflineAccessTokens: true}, isOnline: false, sessionStorage: new MemorySessionStorage()})',
            'app/shopify.server.cts',
          ),
        ],
      }),
    )
    expect(memory).toMatchObject({issues: []})
    expect(memory.unresolvedReason).toBeUndefined()

    const prisma = scanExpiringOfflineTokens(
      context({
        files: [
          source(
            'shopifyApp({future: {expiringOfflineAccessTokens: true}, sessionStorage: new PrismaSessionStorage(prisma)})',
            'app/shopify.server.ts',
          ),
          source(
            'model Session {\n expires DateTime?\n refreshToken String?\n refreshTokenExpires DateTime?\n}',
            'prisma/schema.prisma',
          ),
        ],
      }),
    )
    expect(prisma.unresolvedReason).toBeUndefined()
  })

  test('hands absent flags and ambiguous storage to the unresolved runner path', () => {
    const absent = scanExpiringOfflineTokens(
      context({
        files: [source('shopifyApp({isOnline: false, sessionStorage})', 'app/shopify.server.ts')],
      }),
    )
    expect(absent.issues).toEqual([])
    expect(absent.unresolvedReason).toMatch(/not found/)

    const ambiguous = scanExpiringOfflineTokens(
      context({
        files: [
          source(
            'shopifyApp({future: {expiringOfflineAccessTokens: true}, sessionStorage: new PrismaSessionStorage(prisma)})',
            'app/shopify.server.ts',
          ),
        ],
      }),
    )
    expect(ambiguous.unresolvedReason).toMatch(/compatibility/)
  })
})

describe('Liquid public AST analysis', () => {
  test('distinguishes ordinary src attributes from executable contexts', () => {
    const ordinary = scanLiquidSecurity([
      source('<img src="{{ block.settings.image | escape }}">', 'extensions/theme/blocks/image.liquid'),
    ])
    expect(ordinary.issues).toEqual([])

    const staticAsset = scanLiquidSecurity([
      source('<script src="{{ \'chat.js\' | asset_url }}" defer></script>', 'extensions/theme/blocks/chat.liquid'),
    ])
    expect(staticAsset.issues).toEqual([])

    const script = scanLiquidSecurity([
      source(
        '<script src="{{ block.settings.script | asset_url }}"></script>',
        'extensions/theme/blocks/script.liquid',
      ),
    ])
    expect(script.issues.map((finding) => finding.id)).toEqual(['LIQUID_UNSAFE_RENDER', 'UNSAFE_INNERHTML'])
  })

  test('uses context-specific filters, AST positions, and preserves raw/comment negatives', () => {
    const safe = scanLiquidSecurity([
      source(
        `{% comment %}<script>{{ block.settings.bad }}</script>{% endcomment %}
{% raw %}<script>{{ block.settings.literal }}</script>{% endraw %}
<div title="{{ block.settings.title | escape }}"></div>
<script>const value = {{ block.settings.value | json }};</script>`,
        'extensions/theme/blocks/safe.liquid',
      ),
    ])
    expect(safe.issues).toEqual([])

    const unsafe = scanLiquidSecurity([
      source(
        '\n  <button\n    onclick="{{ block.settings.handler }}">Run</button>',
        'extensions/theme/blocks/unsafe.liquid',
      ),
    ])
    expect(unsafe.issues).toHaveLength(2)
    expect(unsafe.issues[0]?.location).toEqual({file: 'extensions/theme/blocks/unsafe.liquid', line: 3, column: 14})
    expect(scanLiquidSecurity([source('{% if', 'extensions/theme/blocks/broken.liquid')]).parserFailures).toEqual([
      'extensions/theme/blocks/broken.liquid',
    ])
  })
})

describe('JavaScript credential and executable sinks', () => {
  test('supports module extensions and keeps direct flows high signal', () => {
    expect(
      scanCredentialLogLeakage([source('console.error("request failed", accessToken)', 'server/log.mjs')]),
    ).toHaveLength(1)
    expect(
      scanCredentialLogLeakage([
        source(['console.error(`', '$', '{requestId} ', '$', '{accessToken}`)'].join(''), 'server/log.mjs'),
      ]),
    ).toHaveLength(1)
    expect(scanCredentialBrowserLeakage([source('return json({clientSecret})', 'app/routes/a.cts')])).toHaveLength(1)
    expect(
      scanCredentialBrowserLeakage([
        source('fetch("https://example.test/report", {headers: {Authorization: sessionToken}})', 'app/routes/a.mts'),
      ]),
    ).toHaveLength(1)
    expect(
      scanCredentialBrowserLeakage([
        source('fetch("/internal", {headers: {Authorization: sessionToken}})', 'app/routes/a.mts'),
      ]),
    ).toEqual([])
    expect(scanCredentialLogLeakage([source('console.info("accessToken")', 'server/log.cjs')])).toEqual([])
    expect(scanCredentialLogLeakage([source('// console.log(accessToken)', 'server/log.mts')])).toEqual([])
    expect(
      scanCredentialLogLeakage([
        source(
          'console.info({redacted: redact(accessToken), hash: createHash("sha256").update(clientSecret).digest("hex"), present: Boolean(sessionToken)})',
          'server/log.mjs',
        ),
      ]),
    ).toEqual([])
  })

  test('flags dynamic evaluation but ignores static examples, strings, and comments', () => {
    expect(scanUnsafeInnerHTML([source('eval(payload); new Function(source)', 'server/eval.cjs')])).toHaveLength(1)
    expect(
      scanUnsafeInnerHTML([
        source('// eval(payload)\nconst example = "new Function(source)"; eval("fixed expression")', 'server/eval.mts'),
      ]),
    ).toEqual([])
  })

  test('retains the only active Shopify-specific source rule on modern module extensions', () => {
    expect(
      scanDeprecatedScriptTagApi([
        source(
          'admin.graphql(`mutation { scriptTagCreate(input: $input) { scriptTag { id } } }`)',
          'server/install.mjs',
        ),
      ]),
    ).toHaveLength(1)
  })
})
