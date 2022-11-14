import {App, AppInterface} from './app.js'
import {FunctionExtension, ThemeExtension, UIExtension} from './extensions.js'

export function testApp(app: Partial<AppInterface> = {}): AppInterface {
  const newApp = new App(
    app.name ?? 'App',
    app.idEnvironmentVariableName ?? 'SHOPIFY_API_KEY',
    app.directory ?? '/tmp/project',
    app.packageManager ?? 'yarn',
    app.configuration ?? {scopes: '', extensionDirectories: []},
    app.configurationPath ?? '/tmp/project/shopify.app.toml',
    app.nodeDependencies ?? {},
    app.webs ?? [],
    app.extensions?.ui ?? [],
    app.extensions?.theme ?? [],
    app.extensions?.function ?? [],
    app.usesWorkspaces ?? false,
    app.dotenv,
    app.errors,
  )
  if (app.updateDependencies) {
    Object.getPrototypeOf(newApp).updateDependencies = app.updateDependencies
  }
  if (app.hasUIExtensions) {
    Object.getPrototypeOf(newApp).hasUIExtensions = app.hasUIExtensions
  }
  return newApp
}

export function testUIExtension(uiExtension: Partial<UIExtension> = {}): UIExtension {
  const directory = uiExtension?.directory ?? '/tmp/project/extensions/test-ui-extension'

  return {
    localIdentifier: uiExtension?.localIdentifier ?? 'test-ui-extension',
    outputBundlePath: uiExtension?.outputBundlePath ?? `${directory}/dist/main.js`,
    configuration: uiExtension?.configuration ?? {
      name: uiExtension?.configuration?.name ?? 'test-ui-extension',
      type: uiExtension?.configuration?.type ?? 'product_subscription',
      metafields: [],
      capabilities: {
        block_progress: false,
        network_access: false,
      },
    },
    type: 'checkout_post_purchase',
    graphQLType: 'CHECKOUT_POST_PURCHASE',
    configurationPath: uiExtension?.configurationPath ?? `${directory}/shopify.ui.extension.toml`,
    directory,
    entrySourceFilePath: uiExtension?.entrySourceFilePath ?? `${directory}/src/index.js`,
    idEnvironmentVariableName: uiExtension?.idEnvironmentVariableName ?? 'SHOPIFY_TET_UI_EXTENSION_ID',
    devUUID: 'devUUID',
  }
}

export function testThemeExtensions(): ThemeExtension {
  return {
    configuration: {
      name: 'theme extension name',
      type: 'theme',
    },
    idEnvironmentVariableName: '',
    localIdentifier: 'extension title',
    configurationPath: '',
    directory: './my-extension',
    type: 'theme',
    graphQLType: 'THEME_APP_EXTENSION',
  }
}

export function testFunctionExtension(): FunctionExtension {
  return {
    configuration: {
      name: 'test function extension',
      description: 'description',
      type: 'product_discounts',
      build: {
        command: 'echo "hello world"',
      },
      apiVersion: '2022-07',
      configurationUi: true,
    },
    buildWasmPath: () => '',
    inputQueryPath: () => '',
    metadata: {
      schemaVersions: {},
    },
    idEnvironmentVariableName: '',
    localIdentifier: 'extension title',
    configurationPath: '',
    directory: './my-extension',
    type: 'product_discounts',
    graphQLType: 'PRODUCT_DISCOUNTS',
  }
}
