import {appFlags} from '../../../flags.js'
import {validateApp} from '../../../services/validate.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {toRootValidationIssue} from '../../../models/app/error-parsing.js'
import {LocalConfigError} from '../../../models/app/local-config-error.js'
import {invalidAppValidationResult, stringifyAppValidationResult} from '../../../services/validation-result.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {outputResult, stringifyMessage} from '@shopify/cli-kit/node/output'

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

    try {
      const {app} = await linkedAppContext({
        directory: flags.path,
        clientId: flags['client-id'],
        forceRelink: flags.reset,
        userProvidedConfigName: flags.config,
        unsafeTolerateErrors: true,
      })

      await validateApp(app, {json: flags.json})

      return {app}
    } catch (error) {
      if (flags.json && error instanceof LocalConfigError) {
        const issues =
          error.issues.length > 0
            ? error.issues
            : [toRootValidationIssue(error.configurationPath, stringifyMessage(error.message).trim())]
        outputResult(stringifyAppValidationResult(invalidAppValidationResult(issues)))
        throw new AbortSilentError()
      }

      throw error
    }
  }
}
