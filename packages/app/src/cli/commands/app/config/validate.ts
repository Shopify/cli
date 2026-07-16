import {appFlags} from '../../../flags.js'
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
import {renderError} from '@shopify/cli-kit/node/ui'

async function recordValidationFailure(issueCount: number, fileCount: number) {
  await metadata.addPublicMetadata(() => ({
    cmd_app_validate_valid: false,
    cmd_app_validate_issue_count: issueCount,
    cmd_app_validate_file_count: fileCount,
  }))
}

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

    await metadata.addPublicMetadata(() => ({
      cmd_app_validate_json: flags.json,
    }))

    // Stage 1: Load project
    let project: Project
    try {
      project = await Project.load(flags.path)
    } catch (err) {
      if (err instanceof AbortError && flags.json) {
        await recordValidationFailure(1, 1)
        const message = unstyled(stringifyMessage(err.message)).trim()
        outputResult(JSON.stringify({valid: false, issues: [{message}]}, null, 2))
        throw new AbortSilentError()
      }
      throw err
    }

    // Stage 2: Select active config and check for TOML parse errors scoped to it
    let activeConfig
    try {
      activeConfig = await selectActiveConfig(project, flags.config)
    } catch (err) {
      if (err instanceof AbortError && flags.json) {
        await recordValidationFailure(1, 1)
        const message = unstyled(stringifyMessage(err.message)).trim()
        outputResult(JSON.stringify({valid: false, issues: [{message}]}, null, 2))
        throw new AbortSilentError()
      }
      throw err
    }

    const configErrors = errorsForConfig(project, activeConfig.file)
    if (configErrors.length > 0) {
      const issues = configErrors.map((err) => ({file: err.path, message: err.message}))
      const fileCount = new Set(configErrors.map((err) => err.path)).size
      await recordValidationFailure(issues.length, fileCount)
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

    // Stage 3: Load app (link + remote fetch + schema validation)
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
      // Only catch config validation errors for JSON output. Auth/linking/remote
      // failures should propagate normally — they aren't validation results.
      const message = err instanceof AbortError ? unstyled(stringifyMessage(err.message)).trim() : ''
      const isValidationError = message.startsWith('Validation errors in ')
      if (isValidationError && flags.json) {
        await recordValidationFailure(1, 1)
        outputResult(JSON.stringify({valid: false, issues: [{message}]}, null, 2))
        throw new AbortSilentError()
      }
      throw err
    }

    await validateApp(app, {json: flags.json})

    return {app}
  }
}
