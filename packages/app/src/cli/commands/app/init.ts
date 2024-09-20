import initPrompt, {visibleTemplates} from '../../prompts/init/init.js'
import initService from '../../services/init/init.js'
import {selectDeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {appFromId, selectOrg} from '../../services/context.js'
import {selectOrCreateApp} from '../../services/dev/select-app.js'
import AppCommand from '../../utilities/app-command.js'
import {validateFlavorValue, validateTemplateValue} from '../../services/init/validate.js'
import {OrganizationApp} from '../../models/organization.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

import {installGlobalShopifyCLI} from '@shopify/cli-kit/node/is-global'
import {generateRandomNameForSubdirectory} from '@shopify/cli-kit/node/fs'
import {renderText} from '@shopify/cli-kit/node/ui'
import {inferPackageManager} from '@shopify/cli-kit/node/node-package-manager'

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
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Init)

    validateTemplateValue(flags.template)
    validateFlavorValue(flags.template, flags.flavor)

    const inferredPackageManager = inferPackageManager(flags['package-manager'])
    const name = flags.name ?? (await generateRandomNameForSubdirectory({suffix: 'app', directory: flags.path}))

    // Authenticate and select organization and app
    const developerPlatformClient = selectDeveloperPlatformClient()

    let selectedApp: OrganizationApp
    if (flags['client-id']) {
      // If a client-id is provided we don't need to prompt the user and can link directly to that app.
      selectedApp = await appFromId({apiKey: flags['client-id'], developerPlatformClient})
    } else {
      renderText({text: "\nWelcome. Let's get started by linking this new project to an app in your organization."})
      const org = await selectOrg()
      const {organization, apps, hasMorePages} = await developerPlatformClient.orgAndApps(org.id)
      selectedApp = await selectOrCreateApp(name, apps, hasMorePages, organization, developerPlatformClient)
    }

    const promptAnswers = await initPrompt({
      template: flags.template,
      flavor: flags.flavor,
    })

    if (promptAnswers.globalCLIResult.install) {
      await installGlobalShopifyCLI(inferredPackageManager)
    }

    await addPublicMetadata(() => ({
      cmd_create_app_template: promptAnswers.templateType,
      cmd_create_app_template_url: promptAnswers.template,
    }))

    const platformClient = selectedApp.developerPlatformClient ?? developerPlatformClient

    await initService({
      name: selectedApp.title,
      app: selectedApp,
      packageManager: inferredPackageManager,
      template: promptAnswers.template,
      local: flags.local,
      directory: flags.path,
      useGlobalCLI: promptAnswers.globalCLIResult.alreadyInstalled || promptAnswers.globalCLIResult.install,
      developerPlatformClient: platformClient,
      postCloneActions: {
        removeLockfilesFromGitignore: promptAnswers.templateType !== 'custom',
      },
    })
  }
}
