import {App, AppInterface} from './app.js'
import {UIExtension} from './extensions.js'

export function testApp(app: Partial<AppInterface> = {}): AppInterface {
  const newApp = new App(
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
  if (app.updateDependencies) {
    Object.getPrototypeOf(newApp).updateDependencies = app.updateDependencies
  }
  return newApp
}

export function testUIExtension(uiExtension: Partial<UIExtension> = {}): UIExtension {
  return {
    localIdentifier: uiExtension?.localIdentifier ?? 'test-ui-extension',
    outputBundlePath: uiExtension?.outputBundlePath ?? '/tmp/project/extensions/test-ui-extension/dist/main.js',
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
