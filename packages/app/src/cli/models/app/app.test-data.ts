import {App, AppInterface} from './app.js'
import {FunctionExtension, ThemeExtension, UIExtension} from './extensions.js'
import {ExtensionInstance, specForType} from '../extensions/extensions.js'
import {FunctionInstance, functionSpecForType} from '../extensions/functions.js'

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

export async function testUIExtension(uiExtension: Partial<UIExtension> = {}): Promise<UIExtension> {
  const directory = uiExtension?.directory ?? '/tmp/project/extensions/test-ui-extension'

  const configuration = uiExtension?.configuration ?? {
    name: uiExtension?.configuration?.name ?? 'test-ui-extension',
    type: uiExtension?.configuration?.type ?? 'product_subscription',
    metafields: [],
    capabilities: {
      block_progress: false,
      network_access: false,
    },
  }
  const configurationPath = uiExtension?.configurationPath ?? `${directory}/shopify.ui.extension.toml`
  const entrySourceFilePath = uiExtension?.entrySourceFilePath ?? `${directory}/src/index.js`

  const spec = await specForType(configuration.type)

  const extension = new ExtensionInstance(
    configuration,
    configurationPath,
    entrySourceFilePath,
    directory,
    spec!,
    undefined,
    undefined,
  )
  extension.devUUID = uiExtension?.devUUID ?? 'test-ui-extension-uuid'
  return extension
}

export async function testThemeExtensions(): Promise<ThemeExtension> {
  const configuration = {
    name: 'theme extension name',
    type: 'theme',
    metafields: [],
  }

  const spec = await specForType(configuration.type)
  return new ExtensionInstance(configuration, '', '', './my-extension', spec!, undefined, undefined)
}

export async function testFunctionExtension(): Promise<FunctionExtension> {
  const configuration = {
    name: 'test function extension',
    description: 'description',
    type: 'product_discounts',
    build: {
      command: 'echo "hello world"',
    },
    apiVersion: '2022-07',
    configurationUi: true,
  }

  const spec = await functionSpecForType(configuration.type)
  return new FunctionInstance(configuration, '', {schemaVersions: {}}, spec!, './my-extension')
}
