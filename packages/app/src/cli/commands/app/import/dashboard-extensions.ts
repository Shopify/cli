import {appFlags} from '../../../flags.js'
import {
  allExtensionTypes,
  ExtensionImportCancelledError,
  ExtensionImportFailedError,
  importExtensions,
} from '../../../services/import-extensions.js'
import AppLinkedCommand, {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import {linkedAppContext} from '../../../services/app-context.js'
import {getMigrationChoices, selectMigrationChoice} from '../../../prompts/import-extensions.js'
import {getExtensions} from '../../../services/fetch-extensions.js'
import {updateAppIdentifiers} from '../../../models/app/identifiers.js'
import {renderImportExtensionsResult} from '../../../services/import-extensions/result.js'
import {
  importDashboardExtensionsJsonOutputSchema,
  ImportDashboardExtensionsResult,
  ImportedDashboardExtension,
  ImportExtensionsResult,
} from '../../../services/import-extensions/types.js'
import {
  AbortError,
  AbortSilentError,
  errorMapper,
  FatalErrorType,
  shouldReportErrorAsUnexpected,
} from '@shopify/cli-kit/node/error'
import {reportAnalyticsEvent} from '@shopify/cli-kit/node/analytics'
import {sendErrorToBugsnag} from '@shopify/cli-kit/node/error-handler'
import {outputResult, unstyled} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {renderSuccess} from '@shopify/cli-kit/node/ui'

export default class ImportDashboardExtensions extends AppLinkedCommand {
  static descriptionWithMarkdown = 'Import dashboard-managed extensions into your app.'

  static jsonOutputSchema = importDashboardExtensionsJsonOutputSchema

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

    const migrationChoices = getMigrationChoices(extensions)

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
      let identifiersUpdated = false
      try {
        result = await importExtensions({
          ...appContext,
          extensions,
          extensionTypes: migrationChoice.extensionTypes,
          buildExtensionConfig: migrationChoice.buildExtensionConfig,
        })
        if (!flags.json) renderImportExtensionsResult(result.extensions)
        await updateAppIdentifiers({
          app: appContext.app,
          appApiKey: appContext.remoteApp.apiKey,
          extensionUuids: result.extensionUuids,
          command: 'import-extensions',
        })
        identifiersUpdated = true
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
      } catch (error) {
        if (!flags.json) throw error instanceof ExtensionImportFailedError ? error.originalError : error
        if (error instanceof ExtensionImportCancelledError || error instanceof ExtensionImportFailedError) {
          const completion = await error.completedImports()
          if (error instanceof ExtensionImportFailedError && completion.extensions.length === 0) {
            throw error.originalError
          }
          outputResult(
            importDashboardExtensionsJsonOutputSchema.encode({
              status: error instanceof ExtensionImportCancelledError ? 'cancelled' : 'partial',
              reason: error instanceof ExtensionImportCancelledError ? 'directory-selection-cancelled' : null,
              extensions: projectExtensions(completion.extensions),
              errors: completion.failures.map(({extension, error: failure}) => ({
                extensionId: extension.uuid,
                error: projectImportError(failure),
              })),
              identifiersUpdated: false,
            }),
          )
        } else if (result && !identifiersUpdated) {
          outputResult(
            importDashboardExtensionsJsonOutputSchema.encode({
              status: 'partial',
              reason: null,
              extensions: projectExtensions(result.extensions),
              errors: [{extensionId: null, error: projectImportError(error)}],
              identifiersUpdated: false,
            }),
          )
        } else {
          throw error
        }
        if (error instanceof ExtensionImportCancelledError) throw error
        const originalError = error instanceof ExtensionImportFailedError ? error.originalError : error
        const mappedError = await errorMapper(originalError)
        const exitMode = shouldReportErrorAsUnexpected(mappedError) ? 'unexpected_error' : 'expected_error'
        await reportAnalyticsEvent({
          config: this.config,
          errorMessage: mappedError instanceof Error ? mappedError.message : undefined,
          exitMode,
        })
        await sendErrorToBugsnag(mappedError, exitMode)
        throw new AbortSilentError()
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

function projectImportError(error: unknown): ImportDashboardExtensionsResult['errors'][number]['error'] {
  const type =
    error instanceof AbortError || (error instanceof Error && 'type' in error && error.type === FatalErrorType.Abort)
      ? 'abort'
      : 'bug'
  return {
    type,
    message: error instanceof Error ? unstyled(error.message) : String(error),
    ...(error instanceof Error && 'code' in error && typeof error.code === 'string' && error.code.length > 0
      ? {code: error.code}
      : {}),
    ...(error instanceof AbortError && error.details !== undefined ? {details: error.details} : {}),
  }
}
