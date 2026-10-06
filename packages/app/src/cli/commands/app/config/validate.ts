import {appFlags} from '../../../flags.js'
import {appConfigValidateJsonOutputSchema, type AppConfigValidateResult} from '../../../services/validate/types.js'
import {renderAppConfigValidateResult} from '../../../services/validate/result.js'
import {validateApp} from '../../../services/validate.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {selectActiveConfig} from '../../../models/project/active-config.js'
import {errorsForConfig} from '../../../models/project/config-selection.js'
import {Project} from '../../../models/project/project.js'
import metadata from '../../../metadata.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import {outputResult, stringifyMessage, unstyled} from '@shopify/cli-kit/node/output'
import {basename} from '@shopify/cli-kit/node/path'
import {renderError} from '@shopify/cli-kit/node/ui'
// CLI Kit normalizes separators; public JSON paths must use the native filesystem format.
// eslint-disable-next-line no-restricted-imports
import {resolve} from 'node:path'

async function recordValidationFailure(issueCount: number, fileCount: number) {
  await metadata.addPublicMetadata(() => ({
    cmd_app_validate_valid: false,
    cmd_app_validate_issue_count: issueCount,
    cmd_app_validate_file_count: fileCount,
  }))
}

async function failJsonValidation(issues: AppConfigValidateResult['issues']): Promise<never> {
  const fileCount = new Set(issues.map((issue) => issue.filePath)).size
  await recordValidationFailure(issues.length, fileCount)
  outputResult(appConfigValidateJsonOutputSchema.encode({valid: false, issues}))
  throw new AbortSilentError()
}

export default class Validate extends AppLinkedCommand {
  static summary = 'Validate your app configuration and extensions.'

  static descriptionWithMarkdown = `Validates the selected app configuration file and all extension configurations against their schemas and reports any errors found.`

  static get jsonOutputSchema() {
    return appConfigValidateJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
  }

  public async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(Validate)

    await metadata.addPublicMetadata(() => ({
      cmd_app_validate_json: flags.json,
    }))

    const project = await Project.load(flags.path)
    const activeConfig = await selectActiveConfig(project, flags.config, {
      clientId: flags['client-id'],
      skipPrompts: Boolean(flags['client-id']),
    })

    const configErrors = errorsForConfig(project, activeConfig.file)
    if (configErrors.length > 0) {
      const issues = configErrors.map((err) => ({
        filePath: resolve(err.path),
        message: err.message,
        fieldPath: null,
        code: null,
      }))
      if (flags.json) {
        await failJsonValidation(issues)
      }
      const fileCount = new Set(configErrors.map((err) => err.path)).size
      await recordValidationFailure(issues.length, fileCount)
      renderError({
        headline: 'Validation errors found.',
        body: issues.map((issue) => `• ${issue.message}`).join('\n'),
      })
      throw new AbortSilentError()
    }

    // Stage 3: Load app (link + remote fetch + schema validation)
    let app
    try {
      const context = await linkedAppContext({
        directory: flags.path,
        clientId: flags['client-id'],
        forceRelink: flags.reset,
        userProvidedConfigName: flags.config ?? (flags['client-id'] ? basename(activeConfig.file.path) : undefined),
        unsafeTolerateErrors: true,
      })
      app = context.app
    } catch (err) {
      // Only catch config validation errors for JSON output. Auth/linking/remote
      // failures should propagate normally — they aren't validation results.
      const message = err instanceof AbortError ? unstyled(stringifyMessage(err.message)).trim() : ''
      const isValidationError = message.startsWith('Validation errors in ')
      if (isValidationError && flags.json) {
        await failJsonValidation([{filePath: resolve(activeConfig.file.path), message, fieldPath: null, code: null}])
      }
      throw err
    }

    const result = await validateApp(app)
    renderAppConfigValidateResult(result, app.configPath, flags.json ? 'json' : 'text')
    if (!result.valid) throw new AbortSilentError()

    return {app}
  }
}
