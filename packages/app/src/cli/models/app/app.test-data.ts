import {App, UIExtension} from './app'

export function testApp(app: Partial<App> = {}): App {
  return {
    idEnvironmentVariable: app.idEnvironmentVariable ?? 'SHOPIFY_APP_ID',
    configuration: {
      name: app?.configuration?.name ?? 'App',
      scopes: app?.configuration?.scopes ?? '',
    },
    dependencyManager: app.dependencyManager ?? 'yarn',
    directory: app.directory ?? '/tmp/project',
    extensions: {
      ui: app?.extensions?.ui ?? [],
      function: app?.extensions?.function ?? [],
      theme: app?.extensions?.theme ?? [],
    },
    webs: app?.webs ?? [],
    nodeDependencies: app?.nodeDependencies ?? {},
    environment: {
      dotenv: app?.environment?.dotenv ?? {},
      env: app?.environment?.env ?? {},
    },
    configurationPath: app?.configurationPath ?? '/tmp/project/shopify.app.toml',
  }
}

export function testUIExtension(uiExtension: Partial<UIExtension> = {}): UIExtension {
  return {
    localIdentifier: uiExtension?.localIdentifier ?? 'test-ui-extension',
    buildDirectory: uiExtension?.buildDirectory ?? '/tmp/project/extensions/test-ui-extension/build',
    configuration: uiExtension?.configuration ?? {
      name: uiExtension?.configuration?.name ?? 'test-ui-extension',
      type: uiExtension?.configuration?.type ?? 'product_subscription',
      metafields: [],
    },
    configurationPath:
      uiExtension?.configurationPath ?? '/tmp/project/extensions/test-ui-extension/shopify.ui.extension.toml',
    directory: uiExtension?.directory ?? '/tmp/project/extensions/test-ui-extension',
    entrySourceFilePath: uiExtension?.entrySourceFilePath ?? '/tmp/project/extensions/test-ui-extension/src/index.js',
    idEnvironmentVariable: uiExtension?.idEnvironmentVariable ?? 'SHOPIFY_TET_UI_EXTENSION_ID',
  }
}
