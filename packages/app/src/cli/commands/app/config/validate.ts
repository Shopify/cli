import {appFlags} from '../../../flags.js'
import {validateApp} from '../../../services/validate.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {getAppConfigurationContext} from '../../../models/app/loader.js'
import {selectActiveConfig} from '../../../models/project/active-config.js'
import {Project} from '../../../models/project/project.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {outputResult, stringifyMessage, unstyled} from '@shopify/cli-kit/node/output'
import {renderError} from '@shopify/cli-kit/node/ui'

export default class Validate extends AppLinkedCommand {
  static summary = 'Validate your app configuration and extensions.'

  static descriptionWithMarkdown = `Validates the selected app configuration file and all extension configurations against their schemas and reports any errors found.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Validate)

    // Check for TOML parse errors before attempting to link/load.
    // If the active config has parse errors, report them directly
    // instead of falling into the linking flow.
    let project: Project
    try {
      project = await Project.load(flags.path)
    } catch (err) {
      if (err instanceof AbortError && flags.json) {
        const message = unstyled(stringifyMessage(err.message)).trim()
        outputResult(JSON.stringify({valid: false, issues: [{message}]}, null, 2))
        throw new AbortSilentError()
      }
      throw err
    }

    if (project.errors.length > 0) {
      const issues = project.errors.map((err) => ({file: err.path, message: err.message}))
      if (flags.json) {
        outputResult(JSON.stringify({valid: false, issues}, null, 2))
        throw new AbortSilentError()
      }
      renderError({
        headline: 'Validation errors found.',
        body: issues.map((issue) => `• ${issue.message}`).join('\n'),
      })
      throw new AbortSilentError()
    }

    let app
    try {
      const context = await linkedAppContext({
        directory: flags.path,
        clientId: flags['client-id'],
        forceRelink: flags.reset,
        userProvidedConfigName: flags.config,
        unsafeTolerateErrors: true,
      })
      app = context.app
    } catch (err) {
      if (err instanceof AbortError && flags.json) {
        const message = unstyled(stringifyMessage(err.message)).trim()
        outputResult(JSON.stringify({valid: false, issues: [{message}]}, null, 2))
        throw new AbortSilentError()
      }
      throw err
    }

    await validateApp(app, {json: flags.json})

    return {app}
  }
}
