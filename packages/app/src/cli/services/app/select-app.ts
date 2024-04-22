import {MinimalOrganizationApp, OrganizationApp} from '../../models/organization.js'
import {selectAppPrompt} from '../../prompts/dev.js'
import {Flag} from '../dev/fetch.js'
import {ExtensionSpecification} from '../../models/extensions/specification.js'
import {SpecsAppConfiguration} from '../../models/extensions/specifications/types/app_config.js'
import {
  AppModuleVersion,
  DeveloperPlatformClient,
  selectDeveloperPlatformClient,
} from '../../utilities/developer-platform-client.js'
import {selectOrg} from '../context.js'
import {deepMergeObjects} from '@shopify/cli-kit/common/object'

export async function selectApp(): Promise<OrganizationApp> {
  const org = await selectOrg()
  const developerPlatformClient = selectDeveloperPlatformClient({organization: org})
  const {apps, hasMorePages} = await developerPlatformClient.appsForOrg(org.id)
  const selectedApp = await selectAppPrompt(developerPlatformClient, apps, hasMorePages, org.id)
  const fullSelectedApp = await developerPlatformClient.appFromId(selectedApp)
  return fullSelectedApp!
}

export async function fetchAppRemoteConfiguration(
  remoteApp: MinimalOrganizationApp,
  developerPlatformClient: DeveloperPlatformClient,
  specifications: ExtensionSpecification[],
  flags: Flag[],
) {
  const activeAppVersion = await developerPlatformClient.activeAppVersion(remoteApp)
  const appModuleVersionsConfig =
    activeAppVersion?.appModuleVersions.filter(
      (module) =>
        module.specification?.experience === 'configuration' ||
        specifications.find(
          (spec) => spec.identifier === module.specification?.identifier && spec.extensionManagedInToml,
        ),
    ) || []
  if (appModuleVersionsConfig.length === 0) return undefined
  const remoteConfiguration = remoteAppConfigurationExtensionContent(
    appModuleVersionsConfig,
    specifications,
    flags,
  ) as unknown as SpecsAppConfiguration
  return specifications.reduce(
    (simplifiedConfiguration, spec) => spec.simplify?.(simplifiedConfiguration) ?? simplifiedConfiguration,
    remoteConfiguration,
  )
}

export function remoteAppConfigurationExtensionContent(
  configRegistrations: AppModuleVersion[],
  specifications: ExtensionSpecification[],
  flags: Flag[],
) {
  let remoteAppConfig: {[key: string]: unknown} = {}
  const configSpecifications = specifications.filter(
    (spec) => spec.experience === 'configuration' || spec.extensionManagedInToml,
  )
  configRegistrations.forEach((module) => {
    const configSpec = configSpecifications.find(
      (spec) => spec.identifier === module.specification?.identifier.toLowerCase(),
    )
    if (!configSpec) return
    const config = module.config
    if (!config) return

    remoteAppConfig = deepMergeObjects(remoteAppConfig, configSpec.reverseTransform?.(config, {flags}) ?? config)
  })

  return {...remoteAppConfig}
}
