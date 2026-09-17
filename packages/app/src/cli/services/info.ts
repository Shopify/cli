import {appInfoJsonOutputSchema, type AppInfoResult} from './info/types.js'
import {logMetadataForLoadedContext} from './context.js'
import {AppLinkedInterface, getAppScopes} from '../models/app/app.js'
import {Project} from '../models/project/project.js'
import {Organization, OrganizationApp} from '../models/organization.js'

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
    organization: {id: organization.id, businessName: organization.businessName},
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

function withPurgedSchemas(extensions: object[]): object[] {
  return extensions.map((ext) => {
    if ('specification' in ext && ext.specification) {
      const specification = ext.specification
      const specificationWithoutSchema = objectWithoutSchema(specification)
      return {...ext, specification: specificationWithoutSchema}
    } else {
      return ext
    }
  })
}
