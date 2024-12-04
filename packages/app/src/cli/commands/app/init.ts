import initPrompt, {visibleTemplates} from '../../prompts/init/init.js'
import initService from '../../services/init/init.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {appFromId, selectOrg} from '../../services/context.js'
import AppCommand, {AppCommandOutput} from '../../utilities/app-command.js'
import {validateFlavorValue, validateTemplateValue} from '../../services/init/validate.js'
import {MinimalOrganizationApp, Organization, OrganizationApp} from '../../models/organization.js'
import {appNamePrompt, createAsNewAppPrompt, selectAppPrompt} from '../../prompts/dev.js'
import {searchForAppsByNameFactory} from '../../services/dev/prompt-helpers.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

import {installGlobalShopifyCLI} from '@shopify/cli-kit/node/is-global'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {inferPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {AbortError} from '@shopify/cli-kit/node/error'

export default class Init extends AppCommand {
  static summary?: string | undefined = 'Create a new app project'

  static flags = {
    ...globalFlags,
    name: Flags.string({
      char: 'n',
      env: 'SHOPIFY_FLAG_NAME',
      hidden: false,
    }),
    path: Flags.string({
      char: 'p',
      env: 'SHOPIFY_FLAG_PATH',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
      hidden: false,
    }),
    template: Flags.string({
      description: `The app template. Accepts one of the following:
       - <${visibleTemplates.join('|')}>
       - Any GitHub repo with optional branch and subpath, e.g., https://github.com/Shopify/<repository>/[subpath]#[branch]`,
      env: 'SHOPIFY_FLAG_TEMPLATE',
    }),
    flavor: Flags.string({
      description: 'Which flavor of the given template to use.',
      env: 'SHOPIFY_FLAG_TEMPLATE_FLAVOR',
    }),
    'package-manager': Flags.string({
      char: 'd',
      env: 'SHOPIFY_FLAG_PACKAGE_MANAGER',
      hidden: false,
      options: ['npm', 'yarn', 'pnpm', 'bun'],
    }),
    local: Flags.boolean({
      char: 'l',
      env: 'SHOPIFY_FLAG_LOCAL',
      default: false,
      hidden: true,
    }),
    'client-id': Flags.string({
      hidden: false,
      description:
        'The Client ID of your app. Use this to automatically link your new project to an existing app. Using this flag avoids the app selection prompt.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
  }

  async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(Init)

    validateTemplateValue(flags.template)
    validateFlavorValue(flags.template, flags.flavor)

    const inferredPackageManager = inferPackageManager(flags['package-manager'])
    const name = flags.name ?? (await generateRandomNameForSubdirectory({suffix: 'app', directory: flags.path}))

    // Force user authentication before prompting.
    let developerPlatformClient = selectDeveloperPlatformClient()
    await developerPlatformClient.session()

    const promptAnswers = await initPrompt({
      template: flags.template,
      flavor: flags.flavor,
    })

    let selectAppResult: SelectAppOrNewAppNameResult
    let appName: string
    if (flags['client-id']) {
      // If a client-id is provided we don't need to prompt the user and can link directly to that app.
      const selectedApp = await appFromId({apiKey: flags['client-id'], developerPlatformClient})
      appName = selectedApp.title
      developerPlatformClient = selectedApp.developerPlatformClient ?? developerPlatformClient
      selectAppResult = {result: 'existing', app: selectedApp}
    } else {
      const org = await selectOrg()
      developerPlatformClient = selectDeveloperPlatformClient({organization: org})
      const {organization, apps, hasMorePages} = await developerPlatformClient.orgAndApps(org.id)
      selectAppResult = await selectAppOrNewAppName(name, apps, hasMorePages, organization, developerPlatformClient)
      appName = selectAppResult.result === 'new' ? selectAppResult.name : selectAppResult.app.title
    }

    if (promptAnswers.globalCLIResult.install) {
      await installGlobalShopifyCLI(inferredPackageManager)
    }

    await addPublicMetadata(() => ({
      cmd_create_app_template: promptAnswers.templateType,
      cmd_create_app_template_url: promptAnswers.template,
    }))

    const {app} = await initService({
      name: appName,
      selectedAppOrNameResult: selectAppResult,
      packageManager: inferredPackageManager,
      template: promptAnswers.template,
      local: flags.local,
      directory: flags.path,
      useGlobalCLI: promptAnswers.globalCLIResult.alreadyInstalled || promptAnswers.globalCLIResult.install,
      developerPlatformClient,
      postCloneActions: {
        removeLockfilesFromGitignore: promptAnswers.templateType !== 'custom',
      },
    })

    return {app}
  }
}

export type SelectAppOrNewAppNameResult =
  | {
      result: 'new'
      name: string
      org: Organization
    }
  | {
      result: 'existing'
      app: OrganizationApp
    }

/**
 * This method returns either an existing app or a new app name and the data necessary to create it.
 * But doesn't create the app yet, the app creation is deferred and is responsibility of the caller.
 */
async function selectAppOrNewAppName(
  localAppName: string,
  apps: MinimalOrganizationApp[],
  hasMorePages: boolean,
  org: Organization,
  developerPlatformClient: DeveloperPlatformClient,
): Promise<SelectAppOrNewAppNameResult> {
  let createNewApp = apps.length === 0
  if (!createNewApp) {
    createNewApp = await createAsNewAppPrompt()
  }
  if (createNewApp) {
    const name = await appNamePrompt(localAppName)
    return {result: 'new', name, org}
  } else {
    const app = await selectAppPrompt(searchForAppsByNameFactory(developerPlatformClient, org.id), apps, hasMorePages)

    const fullSelectedApp = await developerPlatformClient.appFromId(app)
    if (!fullSelectedApp) throw new AbortError(`App with id ${app.id} not found`)
    return {result: 'existing', app: fullSelectedApp}
  }
}
