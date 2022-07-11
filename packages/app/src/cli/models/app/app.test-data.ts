import {AppInterface, App} from './app.js'
import {UIExtension} from './extensions.js'

/**
 * Subclass of App used exclusively for testing.
 * Use it to mock any method of App that has side effects
 */
class TestApp extends App {
  updateDependencies(): Promise<void> {
    return Promise.resolve()
  }
}

export function testApp(app: Partial<AppInterface> = {}): AppInterface {
  const newApp = new TestApp(
    app.name ?? 'App',
    app.idEnvironmentVariableName ?? 'SHOPIFY_API_KEY',
    app.directory ?? '/tmp/project',
    app.packageManager ?? 'yarn',
    app.configuration ?? {scopes: ''},
    app.configurationPath ?? '/tmp/project/shopify.app.toml',
    app.nodeDependencies ?? {},
    app.webs ?? [],
    app.extensions?.ui ?? [],
    app.extensions?.theme ?? [],
    app.extensions?.function ?? [],
    app.dotenv,
    app.errors,
  )
  return newApp
}

export function testUIExtension(uiExtension: Partial<UIExtension> = {}): UIExtension {
  return {
    localIdentifier: uiExtension?.localIdentifier ?? 'test-ui-extension',
    buildDirectory: uiExtension?.buildDirectory ?? '/tmp/project/extensions/test-ui-extension/dist',
    configuration: uiExtension?.configuration ?? {
      name: uiExtension?.configuration?.name ?? 'test-ui-extension',
      type: uiExtension?.configuration?.type ?? 'product_subscription',
      metafields: [],
    },
    type: 'checkout_post_purchase',
    graphQLType: 'CHECKOUT_POST_PURCHASE',
    configurationPath:
      uiExtension?.configurationPath ?? '/tmp/project/extensions/test-ui-extension/shopify.ui.extension.toml',
    directory: uiExtension?.directory ?? '/tmp/project/extensions/test-ui-extension',
    entrySourceFilePath: uiExtension?.entrySourceFilePath ?? '/tmp/project/extensions/test-ui-extension/src/index.js',
    idEnvironmentVariableName: uiExtension?.idEnvironmentVariableName ?? 'SHOPIFY_TET_UI_EXTENSION_ID',
    devUUID: 'devUUID',
  }
}
