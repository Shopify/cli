import initPrompt, {isPredefinedTemplate, templates, visibleTemplates} from '../prompts/init.js'
import initService from '../services/init.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'

import {PackageManager, packageManager, packageManagerFromUserAgent} from '@shopify/cli-kit/node/node-package-manager'
import {inferPackageManagerForGlobalCLI, installGlobalShopifyCLI} from '@shopify/cli-kit/node/is-global'

export default class Init extends Command {
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
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Init)

    this.validateTemplateValue(flags.template)
    this.validateFlavorValue(flags.template, flags.flavor)

    const inferredPackageManager = this.inferPackageManager(flags['package-manager'])

    const promptAnswers = await initPrompt({
      name: flags.name,
      template: flags.template,
      flavor: flags.flavor,
      directory: flags.path,
    })

    if (promptAnswers.globalCLIResult.install) {
      await installGlobalShopifyCLI(inferredPackageManager)
    }

    await addPublicMetadata(() => ({
      cmd_create_app_template: promptAnswers.templateType,
      cmd_create_app_template_url: promptAnswers.template,
    }))

    await initService({
      name: promptAnswers.name,
      packageManager: inferredPackageManager,
      template: promptAnswers.template,
      local: flags.local,
      directory: flags.path,
      useGlobalCLI: promptAnswers.globalCLIResult.alreadyInstalled || promptAnswers.globalCLIResult.install,
    })
  }

  validateTemplateValue(template: string | undefined) {
    if (!template) {
      return
    }

    const url = this.parseURL(template)
    if (url && url.origin !== 'https://github.com')
      throw new AbortError(
        'Only GitHub repository references are supported, ' +
          'e.g., https://github.com/Shopify/<repository>/[subpath]#[branch]',
      )
    if (!url && !isPredefinedTemplate(template))
      throw new AbortError(
        outputContent`Only ${visibleTemplates
          .map((alias) => outputContent`${outputToken.yellow(alias)}`.value)
          .join(', ')} template aliases are supported`,
      )
  }

  validateFlavorValue(template: string | undefined, flavor: string | undefined) {
    if (!template) {
      if (flavor) {
        throw new AbortError(
          outputContent`The ${outputToken.yellow('--flavor')} flag requires the ${outputToken.yellow(
            '--template',
          )} flag to be set`,
        )
      } else {
        return
      }
    }

    if (!flavor) {
      return
    }

    if (!isPredefinedTemplate(template)) {
      throw new AbortError(
        outputContent`The ${outputToken.yellow('--flavor')} flag is not supported for custom templates`,
      )
    }

    const templateConfig = templates[template]

    if (!templateConfig.branches) {
      throw new AbortError(outputContent`The ${outputToken.yellow(template)} template does not support flavors`)
    }

    if (!templateConfig.branches.options[flavor]) {
      throw new AbortError(
        outputContent`Invalid option for ${outputToken.yellow('--flavor')}\nThe ${outputToken.yellow(
          '--flavor',
        )} flag for ${outputToken.yellow(template)} accepts only ${Object.keys(templateConfig.branches.options)
          .map((alias) => outputContent`${outputToken.yellow(alias)}`.value)
          .join(', ')}`,
      )
    }
  }

  parseURL(url: string): URL | undefined {
    try {
      return new URL(url)
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch (error) {
      return undefined
    }
  }

  inferPackageManager(optionsPackageManager: string | undefined): PackageManager {
    if (optionsPackageManager && packageManager.includes(optionsPackageManager as PackageManager)) {
      return optionsPackageManager as PackageManager
    }
    const usedPackageManager = packageManagerFromUserAgent()
    if (usedPackageManager !== 'unknown') return usedPackageManager

    const globalPackageManager = inferPackageManagerForGlobalCLI()
    if (globalPackageManager !== 'unknown') return globalPackageManager

    return 'npm'
  }
}
