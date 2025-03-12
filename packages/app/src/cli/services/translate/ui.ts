import {TranslationTargetFile, TranslationRequestData, TaskContext} from './types.js'
import {AppLinkedInterface} from '../../models/app/app.js'
import {OrganizationApp} from '../../models/organization.js'
import {pluralize} from '@shopify/cli-kit/common/string'
import {renderSuccess, renderError, renderInfo, renderConfirmationPrompt, TokenItem} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

function generateTranslationFileSummary(file: TranslationTargetFile) {
  const changes = []
  const createSummary = pluralize(
    file.keysToCreate,
    () => [`${file.keysToCreate.length} key to create`],
    () => [`${file.keysToCreate.length} keys to create`],
  ) as string

  const deleteSummary = pluralize(
    file.keysToDelete,
    () => [`${file.keysToDelete.length} key to delete`],
    () => [`${file.keysToDelete.length} keys to delete`],
  ) as string

  const updateSummary = pluralize(
    file.keysToUpdate,
    () => [`${file.keysToUpdate.length} key to update`],
    () => [`${file.keysToUpdate.length} keys to update`],
  ) as string

  if (file.keysToCreate.length > 0) changes.push(createSummary)
  if (file.keysToDelete.length > 0) changes.push(deleteSummary)
  if (file.keysToUpdate.length > 0) changes.push(updateSummary)

  return `${file.fileName} (${changes.join(', ')})`
}

export async function confirmChanges(
  app: AppLinkedInterface,
  remoteApp: OrganizationApp,
  translationRequestData: TranslationRequestData,
  promptContext: string | undefined,
  nonTranslatableTerms: string[],
) {
  if (translationRequestData.targetFilesToUpdate.length > 0) {
    const confirmationResponse = await renderChangesConfirmation(
      app,
      remoteApp,
      translationRequestData,
      promptContext,
      nonTranslatableTerms,
    )
    if (!confirmationResponse) throw new AbortSilentError()
  } else {
    renderNoChanges()
    process.exit(0)
  }
}

async function renderChangesConfirmation(
  app: AppLinkedInterface,
  remoteApp: OrganizationApp,
  translationRequestData: TranslationRequestData,
  promptContext: string | undefined,
  nonTranslatableTerms: string[],
): Promise<boolean> {
  const targetFilesToUpdate = translationRequestData.targetFilesToUpdate.map(generateTranslationFileSummary)

  const appContext = [`App name: ${app.name}`, `App title: ${remoteApp.title}`]
  if (typeof promptContext === 'string') appContext.push(promptContext)

  const confirmInfoTable = {
    'Detected source files': translationRequestData.updatedSourceFiles.map((file) => file.fileName),
    'Target files to update': targetFilesToUpdate,
    ...(nonTranslatableTerms.length > 0 && {'Non translatable terms': nonTranslatableTerms}),
    'Extra app context': appContext,
  }

  const confirmationResponse = await renderConfirmationPrompt({
    message: 'Translation update',
    infoTable: confirmInfoTable,
    confirmationMessage: `Yes, update translations`,
    cancellationMessage: 'No, cancel',
  })
  return confirmationResponse
}

function renderNoChanges() {
  renderInfo({
    headline: 'Translation Check Complete.',
    body: 'All translation files are already up to date. No changes are required at this time.',
  })
}

export function renderErrorMessage(renderResponse: TaskContext) {
  const headline = pluralize(
    renderResponse.errors,
    () => ['Translation request failed.'],
    () => ['Translation requests failed'],
  ) as string

  renderError({
    headline,
    body: [
      {
        list: {
          title: 'Errors',
          items: renderResponse.errors,
        },
      },
    ],
  })
}

export function renderSuccessMessage(_response: TaskContext) {
  renderSuccess({
    headline: 'Translation request successful.',
    body: 'Updated translations. Please review the changes and commit them to your preferred version control system if applicable.',
  })
}

export function noLanguagesConfiguredMessage() {
  const helpLink: TokenItem = {link: {label: 'Learn more.', url: 'https://todo.com'}}

  renderError({
    headline: 'No target languages configured.',
    body: ['You must configure at least one language in the `target_languages` array under `[translations]` on your `shopify.app.toml` to use this command.', helpLink],
  })
}
