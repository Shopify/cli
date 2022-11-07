import {App, AppInterface} from './app.js'
import {ExtensionInstance} from '../extensions/extensions.js'
import {FunctionInstance} from '../extensions/functions.js'
import {allExtensionSpecifications, allFunctionSpecifications} from '../extensions/specifications.js'

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

export async function testUIExtension(uiExtension: Partial<ExtensionInstance> = {}): Promise<ExtensionInstance> {
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

  const specifications = await allExtensionSpecifications()
  const spec = specifications.find((spec) => spec.identifier === configuration.type)

  return new ExtensionInstance(configuration, directory, 'entryPath', directory, spec!, undefined, undefined)
}

export async function testThemeExtensions(): Promise<ExtensionInstance> {
  const directory = './my-extension'
  const configuration = {
    name: 'theme extension name',
    type: 'theme',
  }

  const specifications = await allExtensionSpecifications()
  const spec = specifications.find((spec) => spec.identifier === configuration.type)

  return new ExtensionInstance(configuration, directory, 'entryPath', directory, spec!, undefined, undefined)
}

export async function testFunctionExtension(): Promise<FunctionInstance> {
  const directory = './my-extension'
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
  const metadata = {
    schemaVersions: {},
  }

  const specifications = await allFunctionSpecifications()
  const spec = specifications.find((spec) => spec.identifier === configuration.type)

  return new FunctionInstance(configuration, './my-extension', metadata, spec!, directory)
}
