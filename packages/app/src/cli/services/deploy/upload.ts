import {themeExtensionConfig as generateThemeExtensionConfig} from './theme-extension-config.js'
import {Identifiers, IdentifiersExtensions} from '../../models/app/identifiers.js'
import {AppDeploySchema, AppModuleSettings} from '../../api/graphql/app_deploy.js'

import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {AppDeployOptions, AssetUrlSchema, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {MinimalAppIdentifiers} from '../../models/organization.js'
import {ExtensionUpdateDraftMutationVariables} from '../../api/graphql/partners/generated/update-draft.js'
import {readFileSync} from '@shopify/cli-kit/node/fs'
import {fetch, formData} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {AlertCustomSection, ListToken, TokenItem} from '@shopify/cli-kit/node/ui'
import {partition} from '@shopify/cli-kit/common/collection'
import {getPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {cwd} from '@shopify/cli-kit/node/path'

interface DeployThemeExtensionOptions {
  /** The application API key */
  apiKey: string

  /** Set of local identifiers */
  identifiers: Identifiers

  /** The API client to send authenticated requests  */
  developerPlatformClient: DeveloperPlatformClient
}

/**
 * Uploads theme extension(s)
 * @param options - The upload options
 */
export async function uploadThemeExtensions(
  themeExtensions: ExtensionInstance[],
  options: DeployThemeExtensionOptions,
): Promise<void> {
  const {apiKey, identifiers, developerPlatformClient} = options
  await Promise.all(
    themeExtensions.map(async (themeExtension) => {
      const themeExtensionConfig = await generateThemeExtensionConfig(themeExtension)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const themeId = identifiers.extensionIds[themeExtension.localIdentifier]!
      const themeExtensionInput: ExtensionUpdateDraftMutationVariables = {
        apiKey,
        config: JSON.stringify(themeExtensionConfig),
        context: undefined,
        registrationId: themeId,
        handle: themeExtension.handle,
      }
      const result = await developerPlatformClient.updateExtension(themeExtensionInput)
      if (result.extensionUpdateDraft?.userErrors && result.extensionUpdateDraft?.userErrors.length > 0) {
        const errors = result.extensionUpdateDraft.userErrors.map((error) => error.message).join(', ')
        throw new AbortError(errors)
      }
    }),
  )
}

interface UploadExtensionsBundleOptions {
  /** The ID of the application */
  appId: string

  /** The application API key */
  apiKey: string

  /** The app name */
  name: string

  /** The ID of the organization owning the application */
  organizationId: string

  /** The path to the bundle file to be uploaded */
  bundlePath?: string

  /** The API client to send authenticated requests  */
  developerPlatformClient: DeveloperPlatformClient

  /** App Modules extra data */
  appModules: AppModuleSettings[]

  /** The extensions' numeric identifiers (expressed as a string). */
  extensionIds: IdentifiersExtensions

  /** Wether or not to release the version */
  release: boolean

  /** App version message */
  message?: string

  /** App version identifier */
  version?: string

  /** The git reference url of the app version */
  commitReference?: string
}

interface UploadExtensionValidationError {
  uuid: string
  errors: {
    message: string
    field: string[]
  }[]
}

export interface UploadExtensionsBundleOutput {
  validationErrors: UploadExtensionValidationError[]
  versionTag?: string | null
  message?: string | null
  location: string | undefined
  deployError?: string
}

type ErrorSectionBody = TokenItem
interface ErrorCustomSection extends AlertCustomSection {
  body: ErrorSectionBody
}

/**
 * Uploads a bundle.
 * @param options - The upload options
 */
export async function uploadExtensionsBundle(
  options: UploadExtensionsBundleOptions,
): Promise<UploadExtensionsBundleOutput> {
  let signedURL
  let deployError

  if (options.bundlePath) {
    signedURL = await getExtensionUploadURL(options.developerPlatformClient, {
      id: options.apiKey,
      apiKey: options.apiKey,
      organizationId: options.organizationId,
    })

    const form = formData()
    const buffer = readFileSync(options.bundlePath)
    form.append('my_upload', buffer)
    await fetch(signedURL, {
      method: 'put',
      body: buffer,
      headers: form.getHeaders(),
    })
  }

  const variables: AppDeployOptions = {
    appId: options.appId,
    apiKey: options.apiKey,
    name: options.name,
    organizationId: options.organizationId,
    skipPublish: !options.release,
    message: options.message,
    versionTag: options.version,
    commitReference: options.commitReference,
  }

  if (signedURL) {
    variables.bundleUrl = signedURL
  }

  if (options.appModules.length > 0) {
    variables.appModules = options.appModules
  }

  const result: AppDeploySchema = await handlePartnersErrors(() => options.developerPlatformClient.deploy(variables))

  if (result.appDeploy?.userErrors?.length > 0) {
    const customSections: AlertCustomSection[] = deploymentErrorsToCustomSections(
      result.appDeploy.userErrors,
      options.extensionIds,
      {
        version: options.version,
      },
    )

    if (result.appDeploy.appVersion) {
      deployError = result.appDeploy.userErrors.map((error) => error.message).join(', ')
    } else {
      throw new AbortError({bold: "Version couldn't be created."}, null, [], customSections)
    }
  }

  const validationErrors =
    result.appDeploy.appVersion?.appModuleVersions
      .filter((ver) => ver.validationErrors.length > 0)
      .map((ver) => {
        return {uuid: ver.registrationUuid, errors: ver.validationErrors}
      }) ?? []

  return {
    validationErrors,
    versionTag: result.appDeploy.appVersion?.versionTag,
    location: result.appDeploy.appVersion?.location,
    message: result.appDeploy.appVersion?.message,
    deployError,
  }
}

const VALIDATION_ERRORS_TITLE = '\nValidation errors'
const GENERIC_ERRORS_TITLE = '\n'

export function deploymentErrorsToCustomSections(
  errors: AppDeploySchema['appDeploy']['userErrors'],
  extensionIds: IdentifiersExtensions,
  flags: {
    version?: string
  } = {},
): ErrorCustomSection[] {
  const isExtensionError = (error: (typeof errors)[0]) => {
    return error.details?.some((detail) => detail.extension_id) ?? false
  }

  const isCliError = (error: (typeof errors)[0], extensionIds: IdentifiersExtensions) => {
    const errorExtensionId =
      error.details?.find((detail) => typeof detail.extension_id !== 'undefined')?.extension_id.toString() ?? ''

    return Object.values(extensionIds).includes(errorExtensionId)
  }

  const [extensionErrors, nonExtensionErrors] = partition(errors, (error) => isExtensionError(error))

  const [cliErrors, partnersErrors] = partition(extensionErrors, (error) => isCliError(error, extensionIds))

  const customSections = [
    ...generalErrorsSection(nonExtensionErrors, {version: flags.version}),
    ...cliErrorsSections(cliErrors, extensionIds),
    ...partnersErrorsSections(partnersErrors),
  ]
  return customSections
}

function generalErrorsSection(
  errors: AppDeploySchema['appDeploy']['userErrors'],
  flags: {version?: string} = {},
): ErrorCustomSection[] {
  if (errors.length > 0) {
    if (
      errors.filter(
        (error) => error.field && error.field.includes('version_tag') && error.message === 'has already been taken',
      ).length > 0 &&
      flags.version
    ) {
      return [
        {
          body: [
            'An app version with the name',
            {userInput: flags.version},
            'already exists. Deploy again with a different version name.',
          ],
        },
      ]
    }

    if (errors.length === 1) {
      return [
        {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          body: messageIncludingField(errors[0]!),
        },
      ]
    }

    return [
      {
        body: {
          list: {
            items: errors.map((error) => messageIncludingField(error)),
          },
        },
      },
    ]
  } else {
    return []
  }
}

function cliErrorsSections(errors: AppDeploySchema['appDeploy']['userErrors'], identifiers: IdentifiersExtensions) {
  return errors.reduce<ErrorCustomSection[]>((sections, error) => {
    const errorMessage = messageIncludingField(error, ['unknown'])

    const remoteTitle = error.details.find((detail) => typeof detail.extension_title !== 'undefined')?.extension_title
    const specificationIdentifier = error.details.find(
      (detail) => typeof detail.specification_identifier !== 'undefined',
    )?.specification_identifier
    const extensionIdentifier = error.details
      .find((detail) => typeof detail.extension_id !== 'undefined')
      ?.extension_id.toString()

    const handle = Object.keys(identifiers).find((key) => identifiers[key] === extensionIdentifier)
    let extensionName = handle ?? remoteTitle

    if (specificationIdentifier === 'webhook_subscription') {
      // The remote title is a random identifier in this case
      extensionName = 'Webhook Subscription'
    }

    const existingSection = sections.find((section) => section.title === extensionName)

    if (existingSection) {
      const sectionBody = existingSection.body as ListToken[]
      const errorsList =
        error.category === 'invalid'
          ? sectionBody.find((listToken) => listToken.list.title === VALIDATION_ERRORS_TITLE)
          : sectionBody.find((listToken) => listToken.list.title === GENERIC_ERRORS_TITLE)

      if (errorsList) {
        if (!errorsList.list.items.includes(errorMessage)) {
          errorsList.list.items.push(errorMessage)
        }
      } else {
        sectionBody.push({
          list: {
            title: error.category === 'invalid' ? VALIDATION_ERRORS_TITLE : GENERIC_ERRORS_TITLE,
            items: [errorMessage],
          },
        })
      }
    } else {
      sections.push({
        title: extensionName,
        body: [
          {
            list: {
              title: error.category === 'invalid' ? VALIDATION_ERRORS_TITLE : GENERIC_ERRORS_TITLE,
              items: [errorMessage],
            },
          },
        ],
      })
    }

    sections.forEach((section) => {
      // eslint-disable-next-line id-length
      ;(section.body as ListToken[]).sort((a, b) => {
        if (a.list.title === VALIDATION_ERRORS_TITLE) {
          return 1
        }

        if (b.list.title === VALIDATION_ERRORS_TITLE) {
          return -1
        }

        return 0
      })
    })

    return sections
  }, [])
}

function partnersErrorsSections(errors: AppDeploySchema['appDeploy']['userErrors']) {
  return errors
    .reduce<{title: string | undefined; errorCount: number}[]>((sections, error) => {
      const extensionIdentifier = error.details.find(
        (detail) => typeof detail.extension_title !== 'undefined',
      )?.extension_title

      const existingSection = sections.find((section) => section.title === extensionIdentifier)

      if (existingSection) {
        existingSection.errorCount += 1
      } else {
        sections.push({
          title: extensionIdentifier,
          errorCount: 1,
        })
      }

      return sections
    }, [])
    .map((section) => ({
      title: section.title,
      body: `\n${section.errorCount} error${
        section.errorCount > 1 ? 's' : ''
      } found in your extension. Fix these issues in the Partner Dashboard and try deploying again.`,
    })) as ErrorCustomSection[]
}

function messageIncludingField(
  {field, message}: AppDeploySchema['appDeploy']['userErrors'][number],
  defaultField: string[] = [],
): string {
  const errorField = (field ?? defaultField).join('.').replace('extension_points', 'extensions.targeting')
  return errorField === 'base' || errorField === '' ? message : `${errorField}: ${message}`
}

/**
 * It generates a URL to upload an app bundle.
 * @param apiKey - The application API key
 */
export async function getExtensionUploadURL(
  developerPlatformClient: DeveloperPlatformClient,
  app: MinimalAppIdentifiers,
) {
  const result: AssetUrlSchema = await handlePartnersErrors(() => developerPlatformClient.generateSignedUploadUrl(app))

  if (!result.assetUrl || result.userErrors?.length > 0) {
    const errors = result.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  return result.assetUrl
}

async function handlePartnersErrors<T>(request: () => Promise<T>): Promise<T> {
  try {
    const result = await request()
    return result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.errors?.[0]?.extensions?.type === 'unsupported_client_version') {
      const packageManager = await getPackageManager(cwd())

      throw new AbortError(['Upgrade your CLI version to run the', {command: 'deploy'}, 'command.'], null, [
        ['Run', {command: formatPackageManagerCommand(packageManager, 'shopify upgrade')}],
      ])
    }

    throw error
  }
}
