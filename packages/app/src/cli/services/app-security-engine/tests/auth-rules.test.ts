/* eslint-disable @shopify/cli/no-inline-graphql -- source fixtures exercise AST recognition without executing GraphQL */
import {scanRouteAuthentication} from '../rules/auth-rules.js'
import {AuthProject} from '../rules/auth-bindings.js'
import * as astGrep from '@ast-grep/napi'
import {extname} from '@shopify/cli-kit/node/path'
import {describe, expect, test, vi} from 'vitest'
import type {SourceFile} from '../rules/types.js'

const server = `import {shopifyApp} from '@shopify/shopify-app-react-router/server';
const shopify = shopifyApp({});
export default shopify;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;`

function files(route: string, additional: Record<string, string> = {}): SourceFile[] {
  return Object.entries({'app/shopify.server.ts': server, 'app/routes/orders.ts': route, ...additional}).map(
    ([path, content]) => ({path, absolutePath: `/app/${path}`, ext: extname(path), content}),
  )
}

const imports = `import {authenticate, unauthenticated} from '../shopify.server';`
const offline = `const {admin} = await unauthenticated.admin('example.myshopify.com');`

function route(body: string): string {
  return `${imports}\nexport async function loader({request, context}: LoaderFunctionArgs) {\n${body}\n}`
}

describe('bounded route authentication', () => {
  test('recognizes a genuine Shopify authenticator and returned Admin API context', async () => {
    const result = await scanRouteAuthentication(
      files(
        route(`const {admin} = await authenticate.admin(request);\nreturn admin.graphql('query { orders { id } }');`),
      ),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeUndefined()
    expect(result.inspectedFiles).toContain('app/shopify.server.ts')
  })

  test('follows renamed imports and immutable destructured method aliases', async () => {
    const result = await scanRouteAuthentication(
      files(`import {authenticate as verify} from '../shopify.server.js';
export const action = async ({request: incoming}) => {
 const {admin: verifyAdmin} = verify;
 const verifyAgain = verifyAdmin;
 const authenticated = await verifyAgain(incoming);
 return authenticated.admin.graphql('mutation { productDelete { deletedProductId } }');
};`),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeUndefined()
  })

  test('keeps an awaited authentication promise bound to the incoming request', async () => {
    const result = await scanRouteAuthentication(
      files(
        route(
          `const verification = authenticate.admin(request);\nconst {admin} = await verification;\nreturn admin.graphql('query { orders { id } }');`,
        ),
      ),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeUndefined()
  })

  test.each([
    {name: 'missing verification', body: `${offline}\nreturn admin.graphql('query { orders { id } }');`, line: 4},
    {
      name: 'verification after the operation',
      body: `${offline}\nawait admin.graphql('mutation { productDelete { deletedProductId } }');\nawait authenticate.admin(request);\nreturn null;`,
      line: 4,
    },
    {
      name: 'unawaited verification',
      body: `${offline}\nauthenticate.admin(request);\nreturn admin.graphql('query { orders { id } }');`,
      line: 5,
    },
    {
      name: 'verification inside an unused helper',
      body: `async function unused() { await authenticate.admin(request); }\n${offline}\nreturn admin.graphql('query { orders { id } }');`,
      line: 5,
    },
  ])('reports $name before a known privileged operation', async ({body, line}) => {
    const result = await scanRouteAuthentication(files(route(body)))
    expect(result.issues).toEqual([
      expect.objectContaining({
        id: 'UNAUTHENTICATED_ENDPOINT',
        severity: 'high',
        confidence: 'definite',
        location: {file: 'app/routes/orders.ts', line},
      }),
    ])
    expect(result.unresolvedReason).toBeUndefined()
  })

  test('traces a Worker handler context through an instance factory and renamed property', async () => {
    const result = await scanRouteAuthentication(
      files(
        `export async function loader({request, context}) {
 const {admin} = await context.shopifyApp.authenticate.admin(request);
 return admin.graphql('query { orders { id } }');
}`,
        {
          'app/shopify.server.ts': `import {shopifyApp} from '@shopify/shopify-app-react-router/server';
export function createShopify(env) { return shopifyApp({apiSecretKey: env.SECRET}); }`,
          'workers/app.ts': `import {createRequestHandler} from 'react-router';
import {createShopify} from '../app/shopify.server';
const handler = createRequestHandler(build);
export default {async fetch(request, env) {
 const shopifyApp = createShopify(env);
 return handler(request, {shopifyApp});
}};`,
        },
      ),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeUndefined()
    expect(result.inspectedFiles).toContain('workers/app.ts')
  })

  test('traces getLoadContext only when wired to a recognized adapter', async () => {
    const result = await scanRouteAuthentication(
      files(
        `export async function loader({request, context}) {
 const {admin} = await context.shopify.authenticate.admin(request);
 return admin.graphql('query { orders { id } }');
}`,
        {
          'server.ts': `import {createRequestHandler} from '@react-router/express';
import shopify from './app/shopify.server';
export const handler = createRequestHandler({build, getLoadContext() { return {shopify}; }});`,
        },
      ),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeUndefined()
  })

  test.each([
    {
      name: 'context origin absent',
      body: `${offline}\nawait context.shopify.authenticate.admin(request);\nreturn admin.graphql('query { orders { id } }');`,
    },
    {
      name: 'custom authentication wrapper',
      body: `${offline}\nawait requireShopSession(request);\nreturn admin.graphql('query { orders { id } }');`,
    },
    {
      name: 'conditional verification',
      body: `${offline}\nif (request.headers.get('x-check')) await authenticate.admin(request);\nreturn admin.graphql('query { orders { id } }');`,
    },
    {
      name: 'swallowed rejection',
      body: `${offline}\ntry { await authenticate.admin(request); } catch {}\nreturn admin.graphql('query { orders { id } }');`,
    },
    {
      name: 'computed authentication method',
      body: `${offline}\nawait authenticate['admin'](request);\nreturn admin.graphql('query { orders { id } }');`,
    },
    {
      name: 'different request',
      body: `${offline}\nawait authenticate.admin(otherRequest);\nreturn admin.graphql('query { orders { id } }');`,
    },
    {
      name: 'mutable binding',
      body: `${offline}\nlet verify = authenticate.admin;\nverify = customAuth;\nawait verify(request);\nreturn admin.graphql('query { orders { id } }');`,
    },
    {name: 'arbitrary database call', body: `return prisma.order.findMany();`},
  ])('hands $name to the agent without asserting a vulnerability or a pass', async ({body}) => {
    const result = await scanRouteAuthentication(files(route(body)))
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('does not trust a local object with an authenticator-shaped name', async () => {
    const result = await scanRouteAuthentication(
      files(
        route(
          `const authenticate = {admin: async () => null};\n${offline}\nawait authenticate.admin(request);\nreturn admin.graphql('query { orders { id } }');`,
        ),
      ),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('respects parameter shadowing and hoisted local function bindings', async () => {
    const parameter = await scanRouteAuthentication(
      files(`${imports}
export async function loader({request, authenticate}) { ${offline} await authenticate.admin(request); return admin.graphql('query { orders { id } }'); }`),
    )
    const hoisted = await scanRouteAuthentication(
      files(
        route(
          `${offline}\nawait authenticate.admin(request);\nreturn admin.graphql('query { orders { id } }');\nfunction authenticate() {}`,
        ),
      ),
    )
    expect(parameter.issues).toEqual([])
    expect(parameter.unresolvedReasonCode).toBe('agent_investigation_required')
    expect(hoisted.issues).toEqual([])
    expect(hoisted.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('does not trust an unused function merely named getLoadContext', async () => {
    const result = await scanRouteAuthentication(
      files(route(`await context.shopify.authenticate.admin(request);\nreturn null;`), {
        'server.ts': `import shopify from './app/shopify.server'; export function getLoadContext() { return {shopify}; }`,
      }),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('leaves an exported route wrapper unresolved', async () => {
    const result = await scanRouteAuthentication(
      files(`export const loader = withAuth(async ({request}) => db.order.findMany());`),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('reports syntax failure as a coverage gap', async () => {
    const result = await scanRouteAuthentication(files('export async function loader( { return !@# }'))
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('parser_unavailable')
  })

  test('does not infer authentication from comments or string literals', async () => {
    const result = await scanRouteAuthentication(
      files(
        route(
          `// await authenticate.admin(request);\nconst example = 'await authenticate.admin(request)';\n${offline}\nreturn admin.graphql('query { orders { id } }');`,
        ),
      ),
    )
    expect(result.issues).toHaveLength(1)
    expect(result.unresolvedReason).toBeUndefined()
  })

  test('allows literal public responses without claiming a missing guard', async () => {
    const result = await scanRouteAuthentication(files('export const loader = () => "healthy";'))
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeUndefined()
  })

  test('keeps a confirmed finding when another route needs agent review', async () => {
    const result = await scanRouteAuthentication(
      files(route(`${offline}\nreturn admin.graphql('query { orders { id } }');`), {
        'app/routes/other.ts': `export const action = unknownWrapper(handler);`,
      }),
    )
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]?.location.file).toBe('app/routes/orders.ts')
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('bounds cyclic import resolution and reports incomplete evidence', async () => {
    const result = await scanRouteAuthentication(
      files(
        `import {authenticate} from '../cycle-a';
export async function loader({request}) { await authenticate.admin(request); return null; }`,
        {
          'app/cycle-a.ts': `export {authenticate} from './cycle-b';`,
          'app/cycle-b.ts': `export {authenticate} from './cycle-a';`,
        },
      ),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('follows a bounded re-export and namespace import without trusting identifier spelling', async () => {
    const result = await scanRouteAuthentication(
      files(
        `import * as app from '../authentication';
export async function loader(args) { const {admin} = await app.verify.admin(args.request); return admin.graphql('query { orders { id } }'); }`,
        {
          'app/authentication.ts': `export {authenticate as verify} from './shopify.server';`,
        },
      ),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeUndefined()
  })

  test.each([
    {path: 'app/root.tsx', content: 'export const middleware = [requireUser];'},
    {path: 'server.ts', content: 'app.use(requireUser);'},
  ])('does not report missing auth when unmodeled middleware could guard the route', async ({path, content}) => {
    const result = await scanRouteAuthentication(
      files(route(`${offline}\nreturn admin.graphql('query { orders { id } }');`), {[path]: content}),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('retains an unresolved execution for a mutable exported route', async () => {
    const result = await scanRouteAuthentication(files(`export let loader = async ({request}) => handler(request);`))
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('does not use route locals to resolve module-scope binding origins', async () => {
    const result = await scanRouteAuthentication(
      files(`import {shopifyApp as realFactory} from '@shopify/shopify-app-react-router/server';
const shopify = unknownFactory({});
export async function loader({request}) {
 const unknownFactory = realFactory;
 const {admin} = await shopify.authenticate.admin(request);
 return admin.graphql('query { orders { id } }');
}`),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('rejects ambiguous context producers instead of selecting the trusted one', async () => {
    const result = await scanRouteAuthentication(
      files(route(`await context.shopify.authenticate.admin(request); return null;`), {
        'server.ts': `import {createRequestHandler} from '@react-router/express';
import shopify from './app/shopify.server';
const first = createRequestHandler({build, getLoadContext: () => ({shopify})});
const second = createRequestHandler({build, getLoadContext: () => ({shopify: customInstance})});`,
      }),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('preserves captured bindings when a closure exports the handler', async () => {
    const result = await scanRouteAuthentication(
      files(`${imports}
const handlers = (() => {
 const authenticate = {admin: async () => null};
 return {loader: async ({request}) => {
  await authenticate.admin(request);
  ${offline}
  return admin.graphql('query { orders { id } }');
 }};
})();
export const loader = handlers.loader;`),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('preserves nested block shadowing at the context producer', async () => {
    const result = await scanRouteAuthentication(
      files(
        route(
          `await context.shopify.authenticate.admin(request); ${offline} return admin.graphql('query { orders { id } }');`,
        ),
        {
          'server.ts': `import {createRequestHandler} from 'react-router';
import shopify from './app/shopify.server';
const handle = createRequestHandler(build);
export default {async fetch(request) {
 { const shopify = {authenticate: {admin: async () => null}}; return handle(request, {shopify}); }
}};`,
        },
      ),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('treats an awaited context promise as unresolved rather than absent authentication', async () => {
    const result = await scanRouteAuthentication(
      files(route(`await context.authenticated; ${offline} return admin.graphql('query { orders { id } }');`), {
        'server.ts': `import {createRequestHandler} from 'react-router';
import shopify from './app/shopify.server';
const handle = createRequestHandler(build);
export default {async fetch(request) {
 const authenticated = shopify.authenticate.admin(request);
 return handle(request, {authenticated});
}};`,
      }),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('does not mistake an async instance factory for the instance itself', async () => {
    const result = await scanRouteAuthentication(
      files(`import instance from '../shopify.server';
async function makeShopify() { return instance; }
const shopify = makeShopify();
export async function loader() {
 const {admin} = await shopify.unauthenticated.admin('example.myshopify.com');
 return admin.graphql('query { orders { id } }');
}`),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('does not mistake parser-recovered punctuation for a valid handler', async () => {
    const result = await scanRouteAuthentication(
      files(`${imports}\nexport async function loader() { ${offline} return admin.graphql('query { orders { id } }');`),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('parser_unavailable')
  })

  test('does not infer missing verification when an unknown promise is awaited', async () => {
    const result = await scanRouteAuthentication(
      files(route(`await context.authenticated; ${offline} return admin.graphql('query { orders { id } }');`)),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('does not overlook request verification in a Worker dispatcher', async () => {
    const result = await scanRouteAuthentication(
      files(route(`${offline} return admin.graphql('query { orders { id } }');`), {
        'server.ts': `import {createRequestHandler} from 'react-router';
const handle = createRequestHandler(build);
export default {async fetch(request) { await requireStaff(request); return handle(request, {}); }};`,
      }),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test.each([
    `Object.assign(shopify.authenticate, {admin: async () => null});`,
    `shopify.authenticate.admin = async () => null;`,
    `let alias = shopify.authenticate; alias.admin = async () => null;`,
  ])('does not trust an authenticator modified by another source module', async (mutation) => {
    const result = await scanRouteAuthentication(
      files(
        route(`const {admin} = await authenticate.admin(request); return admin.graphql('query { orders { id } }');`),
        {
          'app/patch.ts': `import shopify from './shopify.server'; ${mutation}`,
        },
      ),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('keeps recursive context factories bounded and unresolved', async () => {
    const result = await scanRouteAuthentication(
      files(route(`await context.shopify.authenticate.admin(request); return null;`), {
        'server.ts': `import {createRequestHandler} from '@react-router/express';
function recursive() { return {a: recursive(), b: recursive()}; }
export const handler = createRequestHandler({build, getLoadContext: recursive});`,
      }),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('does not confuse a default component named loader with a route handler', async () => {
    const result = await scanRouteAuthentication(
      files(
        `${imports}\nexport default async function loader() { ${offline} return admin.graphql('query { orders { id } }'); }`,
      ),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeUndefined()
  })

  test('supports the default filesystem manifest but hands custom routing to the agent', async () => {
    const body = route(`${offline} return admin.graphql('query { orders { id } }');`)
    const standard = await scanRouteAuthentication(
      files(body, {
        'app/routes.ts': `import {flatRoutes} from '@react-router/fs-routes'; export default flatRoutes();`,
      }),
    )
    const custom = await scanRouteAuthentication(files(body, {'app/routes.ts': `export default customRoutes();`}))
    expect(standard.issues).toHaveLength(1)
    expect(standard.unresolvedReason).toBeUndefined()
    expect(custom.issues).toEqual([])
    expect(custom.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('reports an unverified GraphQL call with a static template literal', async () => {
    const query = '`#graphql\nquery Orders { orders(first: 1) { nodes { id } } }\n`'
    const result = await scanRouteAuthentication(files(route(`${offline}\nreturn admin.graphql(${query});`)))
    expect(result.issues).toEqual([
      expect.objectContaining({
        id: 'UNAUTHENTICATED_ENDPOINT',
        location: {file: 'app/routes/orders.ts', line: 4},
      }),
    ])
    expect(result.unresolvedReason).toBeUndefined()
  })

  test('keeps authenticated static-template queries within deterministic coverage', async () => {
    const query = '`#graphql\nquery Orders { orders(first: 1) { nodes { id } } }\n`'
    const result = await scanRouteAuthentication(
      files(route(`const {admin} = await authenticate.admin(request);\nreturn admin.graphql(${query});`)),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeUndefined()
  })

  test('does not assume interpolated templates are inert', async () => {
    const query = `\`#graphql \${buildQuery()}\``
    const result = await scanRouteAuthentication(files(route(`${offline}\nreturn admin.graphql(${query});`)))
    expect(result.issues).toEqual([])
    expect(result.unresolvedReasonCode).toBe('agent_investigation_required')
  })

  test('evaluates authentication in arguments before reporting the GraphQL operation', async () => {
    const query = '`#graphql\nquery Products($query: String!) { products(first: 1, query: $query) { nodes { id } } }\n`'
    const result = await scanRouteAuthentication(
      files(
        route(
          `${offline}\nreturn admin.graphql(${query}, {variables: {query: (await authenticate.admin(request)).session.shop}});`,
        ),
      ),
    )
    expect(result.issues).toEqual([])
    expect(result.unresolvedReason).toBeUndefined()
  })

  test('contains parser exceptions to the affected file and continues inspecting other files', () => {
    const sourceFiles = files('export const loader = () => null;', {'app/routes/bad.ts': 'broken source'})
    const parser = {...astGrep}
    vi.spyOn(parser, 'parse').mockImplementationOnce(() => {
      throw new SyntaxError('Native parser rejected this input')
    })
    const project = new AuthProject(sourceFiles, parser)
    expect(project.module('app/routes/bad.ts')).toBeUndefined()
    expect(project.module('app/routes/orders.ts')?.exports.has('loader')).toBe(true)
    expect([...project.parserFailures]).toEqual(['app/routes/bad.ts'])
  })

  test('does not turn analyzer inspection bugs into parser failures', () => {
    const sourceFiles = files('export const loader = () => null;')
    const inspectionError = new Error('Broken AST inspection invariant')
    const root = new Proxy(astGrep.parse(astGrep.Lang.TypeScript, sourceFiles[1]!.content!).root(), {
      get() {
        throw inspectionError
      },
    })
    const parser = {...astGrep}
    vi.spyOn(parser, 'parse').mockReturnValue({root: () => root, filename: () => 'app/routes/orders.ts'})
    const project = new AuthProject(sourceFiles, parser)
    expect(() => project.module('app/routes/orders.ts')).toThrow(inspectionError)
    expect([...project.parserFailures]).toEqual([])
  })
})
