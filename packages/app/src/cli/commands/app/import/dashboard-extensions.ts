import {appFlags} from '../../../flags.js'
import {
  allExtensionTypes,
  ExtensionImportCancelledError,
  ExtensionImportFailedError,
  filterOutImportedExtensions,
  importExtensions,
} from '../../../services/import-extensions.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {getMigrationChoices, selectMigrationChoice} from '../../../prompts/import-extensions.js'
import {getExtensions} from '../../../services/fetch-extensions.js'
import {updateAppIdentifiers} from '../../../models/app/identifiers.js'
import {
  renderImportExtensionsFailureResult,
  renderImportExtensionsResult,
} from '../../../services/import-extensions/result.js'
import {
  importDashboardExtensionsJsonOutputSchema,
  ImportDashboardExtensionsResult,
  ImportedDashboardExtension,
  ImportExtensionsResult,
} from '../../../services/import-extensions/types.js'
import {AbortSilentError, errorMapper, shouldReportErrorAsUnexpected} from '@shopify/cli-kit/node/error'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {sendErrorToBugsnag} from '@shopify/cli-kit/node/error-handler'
import {flushStdout, outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class ImportDashboardExtensions extends AppLinkedCommand {
  static descriptionWithMarkdown = 'Import dashboard-managed extensions into your app.'

  static get jsonOutputSchema() {
    return importDashboardExtensionsJsonOutputSchema
  }

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...appFlags,
    ...jsonFlag,
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
  }

  async run(): Promise<AppLinkedCommandOutput> {
    const {flags} = await this.parse(ImportDashboardExtensions)
    const appContext = await linkedAppContext({
      directory: flags.path,
      clientId: flags['client-id'],
      forceRelink: flags.reset,
      userProvidedConfigName: flags.config,
    })

    const extensions = await getExtensions({
      developerPlatformClient: appContext.developerPlatformClient,
      apiKey: appContext.remoteApp.apiKey,
      organizationId: appContext.remoteApp.organizationId,
      extensionTypes: allExtensionTypes,
    })

    const migrationChoices = getMigrationChoices(
      flags.json ? filterOutImportedExtensions(appContext.app, extensions) : extensions,
    )

    if (migrationChoices.length === 0) {
      if (flags.json) {
        outputResult(
          importDashboardExtensionsJsonOutputSchema.encode({
            status: 'skipped',
            reason: 'no-extensions',
            extensions: [],
            errors: [],
            identifiersUpdated: false,
          }),
        )
      } else {
        renderSuccess({headline: ['No extensions to migrate.']})
      }
    } else {
      const migrationChoice = await selectMigrationChoice(migrationChoices)
      let result: ImportExtensionsResult | undefined
      try {
        result = await importExtensions({
          ...appContext,
          extensions,
          extensionTypes: migrationChoice.extensionTypes,
          buildExtensionConfig: migrationChoice.buildExtensionConfig,
        })
        if (flags.json && result.status === 'skipped') {
          outputResult(
            importDashboardExtensionsJsonOutputSchema.encode({
              status: result.status,
              reason: result.reason,
              extensions: [],
              errors: [],
              identifiersUpdated: false,
            }),
          )
          return {app: appContext.app}
        }
        if (!flags.json) renderImportExtensionsResult(result)
        await updateAppIdentifiers({
          app: appContext.app,
          appApiKey: appContext.remoteApp.apiKey,
          extensionUuids: result.extensionUuids,
          command: 'import-extensions',
        })
      } catch (error) {
        if (!flags.json) throw error instanceof ExtensionImportFailedError ? error.originalError : error
        const failure = await resolveImportFailure(error, result)
        renderImportExtensionsFailureResult(projectExtensions(failure.extensions), failure.errors, failure.cancelled)
        if (!failure.cancelled) {
          const mappedError = await errorMapper(failure.originalError)
          const exitMode = shouldReportErrorAsUnexpected(mappedError) ? 'unexpected_error' : 'expected_error'
          await reportAnalyticsEvent({
            config: this.config,
            errorMessage: mappedError instanceof Error ? mappedError.message : undefined,
            exitMode,
          })
          await sendErrorToBugsnag(mappedError, exitMode)
        }
        await flushStdout()
        throw failure.cancelled ? error : new AbortSilentError()
      }
      if (flags.json) {
        outputResult(
          importDashboardExtensionsJsonOutputSchema.encode({
            status: 'success',
            reason: null,
            extensions: projectExtensions(result.extensions),
            errors: [],
            identifiersUpdated: true,
          }),
        )
      }
    }

    return {app: appContext.app}
  }
}

function projectExtensions(extensions: ImportedDashboardExtension[]): ImportDashboardExtensionsResult['extensions'] {
  return extensions.map(({extension, directory, configurationPath, changed}) => ({
    id: extension.uuid,
    name: extension.title,
    type: extension.type,
    directory,
    configurationPath,
    changed,
  }))
}

async function resolveImportFailure(error: unknown, result: ImportExtensionsResult | undefined) {
  if (error instanceof ExtensionImportCancelledError || error instanceof ExtensionImportFailedError) {
    const completion = await error.completedImports()
    if (error instanceof ExtensionImportFailedError && completion.extensions.length === 0) {
      throw error.originalError
    }
    const cancelled = error instanceof ExtensionImportCancelledError && completion.failures.length === 0
    const originalError = error instanceof ExtensionImportFailedError ? error.originalError : error
    return {
      extensions: completion.extensions,
      errors: completion.failures.map(({extension, error: failure}) => ({extensionId: extension.uuid, error: failure})),
      cancelled,
      originalError:
        error instanceof ExtensionImportCancelledError && !cancelled ? completion.failures[0]!.error : originalError,
    }
  }
  if (!result) throw error
  return {
    extensions: result.extensions,
    errors: [{extensionId: null, error}],
    cancelled: false,
    originalError: error,
  }
}
