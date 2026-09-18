import {appInfoJsonOutputSchema, remoteAppInfoSchema, type AppInfoResult} from './info/types.js'
import {logMetadataForLoadedContext} from './context.js'
import {AppLinkedInterface, getAppScopes} from '../models/app/app.js'
import {Project} from '../models/project/project.js'
import {Organization, OrganizationApp} from '../models/organization.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import {platformAndArch} from '@shopify/cli-kit/node/os'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

export async function info(
  app: AppLinkedInterface,
  remoteApp: OrganizationApp,
  organization: Organization,
  project: Project,
  options: {webEnv: boolean},
): Promise<AppInfoResult> {
  if (options.webEnv) {
    await logMetadataForLoadedContext(remoteApp, organization.source)
    return {
      SHOPIFY_API_KEY: remoteApp.apiKey,
      ...(remoteApp.apiSecretKeys[0] ? {SHOPIFY_API_SECRET: remoteApp.apiSecretKeys[0].secret} : {}),
      SCOPES: getAppScopes(app.configuration),
    }
  }
  const appWithSupportedExtensions = {
    ...app,
    packageManager: project.packageManager,
    nodeDependencies: project.nodeDependencies,
    usesWorkspaces: project.usesWorkspaces,
    organization: {id: organization.id, businessName: organization.businessName, source: organization.source},
    remoteApp: remoteAppInfoSchema.parse(remoteApp),
    // Loading the linked app has already initialized the client session.
    account: await remoteApp.developerPlatformClient.accountInfo(),
    project: {
      directory: project.directory,
      appConfigFiles: project.appConfigFiles.map(configFileInfo),
      extensionConfigFiles: project.extensionConfigFiles.map(configFileInfo),
      webConfigFiles: project.webConfigFiles.map(configFileInfo),
      dotenvFiles: [...project.dotenvFiles.values()].map(({path}) => ({path})),
      errors: (project.errors ?? []).map(({path, message}) => ({path, message})),
    },
    system: {cliVersion: CLI_KIT_VERSION, nodeVersion: process.version, ...platformAndArch(), shell: process.env.SHELL},
    devStoreUrl: app.configuration.build?.dev_store_url ?? app.hiddenConfig.dev_store_url,
    allExtensions: withPurgedSchemas(app.allExtensions.filter((extension) => extension.isReturnedAsInfo())),
    realExtensions: withPurgedSchemas(app.realExtensions),
    specifications: app.specifications.map(objectWithoutSchema),
  }

  // The legacy result exposes enumerable model data. Materialize its JSON value to
  // retain omission rules for functions/undefined and serialization of model objects.
  const result = JSON.parse(
    JSON.stringify(
      Object.fromEntries(Object.entries(appWithSupportedExtensions).filter(([key]) => key !== 'configSchema')),
    ),
  )
  return appInfoJsonOutputSchema.validate(result)
}

function objectWithoutSchema(obj: object): object {
  if ('schema' in obj) {
    const {schema, ...rest} = obj
    return rest
  }
  return obj
}

function configFileInfo({path, content, errors}: TomlFile) {
  return {path, content, errors: errors.map(({path, message}) => ({path, message}))}
}

function withPurgedSchemas(extensions: ExtensionInstance[]): object[] {
  return extensions.map((extension) => ({
    ...extension,
    name: extension.name,
    type: extension.type,
    externalType: extension.externalType,
    humanName: extension.humanName,
    surface: extension.surface,
    features: extension.features,
    dependency: extension.dependency,
    specification: objectWithoutSchema(extension.specification),
  }))
}
