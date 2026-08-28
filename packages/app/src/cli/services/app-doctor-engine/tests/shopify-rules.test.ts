import {scanUnauthenticatedEndpoints} from '../rules/endpoint-rules.js'
import {
  scanAppProxyUnverifiedSignature,
  scanDeprecatedScriptTagApi,
  scanRequestControlledAdminContext,
  scanRuntimeConfigScriptExecution,
  scanStaticFrameAncestors,
  scanUnscopedShopConfigWrite,
} from '../rules/shopify-rules.js'
import {describe, expect, test} from 'vitest'
/* eslint-disable @shopify/cli/no-inline-graphql -- inline source snippets are scanner test fixtures */
import type {SourceFile} from '../rules/types.js'

const sourceFile = (path: string, content: string): SourceFile => ({
  path,
  absolutePath: `/app/${path}`,
  ext: path.slice(path.lastIndexOf('.')),
  content,
})

describe('Shopify-specific security rules', () => {
  test('flags request-controlled shop selection of unauthenticated Admin API context', () => {
    const issues = scanRequestControlledAdminContext([
      sourceFile(
        'app/routes/app.combined_listings.$id/action.ts',
        `export const action = async ({ request }) => {
  const formData = await request.formData();
  return getGraphqlClient(request, formData);
};
async function getGraphqlClient(request: Request, formData: FormData) {
  const { admin } = await authenticate.admin(request);
  const shop = formData.get("shop");
  if (typeof shop === "string" && shop.length > 0) {
    const { admin: requestedShopAdmin } = await unauthenticated.admin(shop);
    return requestedShopAdmin.graphql;
  }
  return admin.graphql;
}`,
      ),
    ])

    expect(issues).toHaveLength(1)
    expect(issues[0]?.id).toBe('REQUEST_CONTROLLED_ADMIN_CONTEXT')
    expect(issues[0]?.location.line).toBe(9)
  })

  test('does not also report a route as unauthenticated when auth is delegated to a helper', () => {
    const issues = scanUnauthenticatedEndpoints([
      sourceFile(
        'app/routes/app.combined_listings.$id/action.ts',
        `export const action = async ({ request }) => {
  const formData = await request.formData();
  const graphql = await getGraphqlClient(request, formData);
  return updateCombinedListing(graphql);
};
async function getGraphqlClient(request: Request, formData: FormData) {
  const { admin } = await authenticate.admin(request);
  return admin.graphql;
}`,
      ),
    ])

    expect(issues).toHaveLength(0)
  })

  test('stays silent when unauthenticated Admin API context uses a trusted job shop', () => {
    const issues = scanRequestControlledAdminContext([
      sourceFile(
        'server/jobs/sync.ts',
        `export const sync = async (job: SyncJob) => {
  const { admin } = await unauthenticated.admin(job.shop);
  return admin.graphql("mutation Sync { productUpdate { id } }");
};`,
      ),
    ])

    expect(issues).toHaveLength(0)
  })

  test('flags runtime config script execution', () => {
    const issues = scanRuntimeConfigScriptExecution([
      sourceFile(
        'extensions/widget/assets/loader.ts',
        `const config = await (await fetch("/apps/widget/config")).json();
const script = document.createElement("script");
script.src = config.external_script;
document.head.appendChild(script);`,
      ),
    ])

    expect(issues.map((issue) => issue.id)).toEqual(['RUNTIME_CONFIG_SCRIPT_EXECUTION'])
  })

  test('flags deprecated ScriptTag creation but not deletion', () => {
    const created = scanDeprecatedScriptTagApi([
      sourceFile(
        'app/services/install.ts',
        `await admin.graphql("mutation { scriptTagCreate(input: { src: $src }) { scriptTag { id } } }");`,
      ),
    ])
    const deleted = scanDeprecatedScriptTagApi([
      sourceFile(
        'app/services/uninstall.ts',
        `await admin.graphql("mutation { scriptTagDelete(id: $id) { deletedScriptTagId } }");`,
      ),
    ])

    expect(created.map((issue) => issue.id)).toEqual(['DEPRECATED_SCRIPT_TAG_API'])
    expect(deleted).toHaveLength(0)
  })

  test('flags app proxy params without signature verification', () => {
    const unsafe = scanAppProxyUnverifiedSignature([
      sourceFile(
        'app/routes/proxy.wishlist.ts',
        `export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const customerId = url.searchParams.get("logged_in_customer_id");
  return json(await loadWishlist(customerId));
};`,
      ),
    ])
    const safe = scanAppProxyUnverifiedSignature([
      sourceFile(
        'app/routes/proxy.wishlist.ts',
        `export const loader = async ({ request }) => {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const customerId = url.searchParams.get("logged_in_customer_id");
  return json(await loadWishlist(session.shop, customerId));
};`,
      ),
    ])

    expect(unsafe.map((issue) => issue.id)).toEqual(['APP_PROXY_UNVERIFIED_SIGNATURE'])
    expect(safe).toHaveLength(0)
  })

  test('flags unscoped config writes using request-controlled shops', () => {
    const issues = scanUnscopedShopConfigWrite([
      sourceFile(
        'server/api/update-settings.ts',
        `export const handler = async (req, res) => {
  const shop = req.body.shop;
  await widgetSettings.updateOne({ shop }, { $set: req.body.settings });
  res.json({ ok: true });
};`,
      ),
    ])

    expect(issues.map((issue) => issue.id)).toEqual(['UNSCOPED_SHOP_CONFIG_WRITE'])
  })

  test('flags wildcard frame-ancestors in Shopify app code', () => {
    const issues = scanStaticFrameAncestors([
      sourceFile(
        'server/headers.ts',
        `import "@shopify/shopify-app-remix";
res.setHeader("Content-Security-Policy", "frame-ancestors https://*.myshopify.com https://admin.shopify.com");`,
      ),
    ])

    expect(issues.map((issue) => issue.id)).toEqual(['STATIC_FRAME_ANCESTORS'])
  })
})

/* eslint-enable @shopify/cli/no-inline-graphql */
