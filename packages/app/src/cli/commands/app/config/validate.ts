import {appFlags} from '../../../flags.js'
import {validateApp} from '../../../services/validate.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {selectActiveConfig, ActiveConfigError} from '../../../models/project/active-config.js'
import {errorsForConfig} from '../../../models/project/config-selection.js'
import {Project, ProjectError} from '../../../models/project/project.js'
import {AppConfigValidationError, formatConfigurationError} from '../../../models/app/loader.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderError} from '@shopify/cli-kit/node/ui'
import {TomlFileError} from '@shopify/cli-kit/node/toml/toml-file'

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
      const project = await Project.load(flags.path)
      const activeConfig = await selectActiveConfig(project, flags.config)

      const configErrors = errorsForConfig(project, activeConfig.file)
      if (configErrors.length > 0) {
        const issues = configErrors.map((err) => ({file: err.details.path, message: err.details.message}))
        if (flags.json) {
          outputValidationJson({valid: false, issues})
        } else {
          renderError({
            headline: 'Validation errors found.',
            body: issues.map((issue) => `• ${issue.message}`).join('\n'),
          })
        }
        throw new AbortSilentError()
      }

      const {app} = await linkedAppContext({
        directory: flags.path,
        clientId: flags['client-id'],
        forceRelink: flags.reset,
        userProvidedConfigName: flags.config,
        unsafeTolerateErrors: true,
      })

      await validateApp(app, {json: flags.json})
      return {app}
    } catch (err) {
      if (!flags.json) throw err

      if (err instanceof TomlFileError) {
        outputValidationJson({valid: false, issues: [{file: err.details.path, message: err.details.message}]})
      } else if (err instanceof ProjectError) {
        outputValidationJson({
          valid: false,
          issues: [{message: `No app configuration found in ${err.details.directory}`}],
        })
      } else if (err instanceof ActiveConfigError) {
        outputValidationJson({
          valid: false,
          issues: [{message: `Config ${err.details.configName} not found in ${err.details.directory}`}],
        })
      } else if (err instanceof AppConfigValidationError) {
        outputValidationJson({
          valid: false,
          issues: err.details.errors.map((ce) => ({
            file: ce.file,
            message: formatConfigurationError(ce),
            path: ce.path,
            code: ce.code,
          })),
        })
      } else {
        throw err
      }
      throw new AbortSilentError()
    }
  }
}

function outputValidationJson(result: {valid: boolean; issues: object[]}) {
  outputResult(JSON.stringify(result, null, 2))
}
