import {ExtensionUuidsByLocalIdentifier} from '../../models/app/identifiers.js'
import {AppDeploySchema, AppModuleSettings} from '../../api/graphql/app_deploy.js'

import {AppDeployOptions, DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {getUploadURL, uploadToGCS} from '../bundle.js'
import {AppManifest} from '../../models/app/app.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {AlertCustomSection, ListToken, TokenItem} from '@shopify/cli-kit/node/ui'
import {partition} from '@shopify/cli-kit/common/collection'

interface UploadExtensionsBundleOptions {
  appManifest: AppManifest

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

  appModuleRegistrationIds: ExtensionUuidsByLocalIdentifier

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
  location: string
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
    signedURL = await getUploadURL(options.developerPlatformClient, {
      id: options.apiKey,
      apiKey: options.apiKey,
      organizationId: options.organizationId,
    })

    await uploadToGCS(signedURL, options.bundlePath)
  }

  const variables: AppDeployOptions = {
    appManifest: options.appManifest,
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

  const result: AppDeploySchema = await options.developerPlatformClient.deploy(variables)

  if (!result.appDeploy.appVersion) {
    const customSections: AlertCustomSection[] = deploymentErrorsToCustomSections(
      result.appDeploy.userErrors ?? [],
      options.appModuleRegistrationIds,
      options.appModules,
      {
        version: options.version,
      },
    )
    throw new AbortError({bold: "Version couldn't be created."}, null, [], customSections)
  }

  if (result.appDeploy.userErrors?.length > 0) {
    deployError = result.appDeploy.userErrors.map((error) => error.message).join(', ')
  }

  const validationErrors = result.appDeploy.appVersion.appModuleVersions
    .filter((ver) => ver.validationErrors.length > 0)
    .map((ver) => {
      return {uuid: ver.registrationUuid, errors: ver.validationErrors}
    })

  return {
    validationErrors,
    versionTag: result.appDeploy.appVersion.versionTag,
    location: result.appDeploy.appVersion.location,
    message: result.appDeploy.appVersion.message,
    deployError,
  }
}

const VALIDATION_ERRORS_TITLE = '\nValidation errors'
const GENERIC_ERRORS_TITLE = '\n'
const BUNDLE_SIZE_EXCEPTION_TITLE = '\nBundle size exception'

interface BundleSizeLimitErrorDetail {
  type: 'bundle_size_limit'
  limit_kb?: number
}

function bundleSizeLimitDetail(
  error: AppDeploySchema['appDeploy']['userErrors'][number],
): BundleSizeLimitErrorDetail | undefined {
  const on = error.on as unknown
  if (!Array.isArray(on)) return undefined
  return on.find(
    (entry): entry is BundleSizeLimitErrorDetail =>
      typeof entry === 'object' && entry !== null && (entry as {type?: unknown}).type === 'bundle_size_limit',
  )
}

function bundleSizeExceptionSection(detail: BundleSizeLimitErrorDetail): ListToken {
  const limitText = detail.limit_kb ? `${detail.limit_kb} KB (compressed)` : 'the current limit'
  return {
    list: {
      title: BUNDLE_SIZE_EXCEPTION_TITLE,
      items: [
        `This extension's bundle exceeds ${limitText}. If you can't reduce it, run \`shopify app bundle-size-exception request\` to ask Shopify for a bundle size exception.`,
      ],
    },
  }
}

export function deploymentErrorsToCustomSections(
  errors: AppDeploySchema['appDeploy']['userErrors'],
  appModuleRegistrationIds: ExtensionUuidsByLocalIdentifier,
  appModules: AppModuleSettings[],
  flags: {
    version?: string
  } = {},
): ErrorCustomSection[] {
  const isExtensionError = (error: (typeof errors)[0]) => {
    return error.details?.some((detail) => detail.extension_id) ?? false
  }

  const isCliError = (error: (typeof errors)[0], appModuleRegistrationIds: ExtensionUuidsByLocalIdentifier) => {
    const errorExtensionId =
      error.details?.find((detail) => typeof detail.extension_id !== 'undefined')?.extension_id ?? ''

    return Object.values(appModuleRegistrationIds).includes(errorExtensionId.toString())
  }

  const isAppManagementValidationError = (error: (typeof errors)[0]) => {
    const on = error.on ? (error.on[0] as {user_identifier: unknown}) : undefined
    return appModules.some((module) => module.uid === on?.user_identifier)
  }

  const [appManagementErrors, nonAppManagementErrors] = partition(errors, (err) => isAppManagementValidationError(err))

  const [extensionErrors, nonExtensionErrors] = partition(nonAppManagementErrors, (error) => isExtensionError(error))

  const [cliErrors, partnersErrors] = partition(extensionErrors, (error) => isCliError(error, appModuleRegistrationIds))

  const customSections = [
    ...generalErrorsSection(nonExtensionErrors, {version: flags.version}),
    ...cliErrorsSections(cliErrors, appModuleRegistrationIds),
    ...partnersErrorsSections(partnersErrors),
    ...appManagementErrorsSection(appManagementErrors, appModules),
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
          body: errors[0]?.message ?? '',
        },
      ]
    }

    return [
      {
        body: {
          list: {
            items: errors.map((error) => error.message),
          },
        },
      },
    ]
  } else {
    return []
  }
}

function cliErrorsSections(
  errors: AppDeploySchema['appDeploy']['userErrors'],
  identifiers: ExtensionUuidsByLocalIdentifier,
) {
  return errors.reduce<ErrorCustomSection[]>((sections, error) => {
    const field = (error.field ?? ['unknown']).join('.').replace('extension_points', 'extensions.targeting')
    const errorMessage = field === 'base' ? error.message : `${field}: ${error.message}`

    const remoteTitle = error.details.find((detail) => typeof detail.extension_title !== 'undefined')?.extension_title
    const specificationIdentifier = error.details.find(
      (detail) => typeof detail.specification_identifier !== 'undefined',
    )?.specification_identifier
    const extensionIdentifier = error.details
      .find((detail) => typeof detail.extension_id !== 'undefined')
      ?.extension_id?.toString()

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

function appManagementErrorsSection(
  errors: AppDeploySchema['appDeploy']['userErrors'],
  appModules: AppModuleSettings[],
) {
  return errors.reduce<ErrorCustomSection[]>((sections, error) => {
    // Find the app module that corresponds to this error
    const on = error.on ? (error.on[0] as {user_identifier: unknown}) : undefined
    const userIdentifier = on?.user_identifier as string | undefined
    const appModule = appModules.find((module) => module.uid === userIdentifier)

    const fallBackName = userIdentifier ? `Extension with uid: ${userIdentifier}` : 'Unknown Extension'
    const extensionName = appModule?.handle ?? fallBackName

    const field = (error.field ?? ['unknown']).join('.')
    const errorMessage = `${field}: ${error.message}`

    // Find or create section for this extension
    let section = sections.find((existingSection) => existingSection.title === extensionName)

    if (section) {
      const sectionBody = section.body as ListToken[]
      const errorsList = sectionBody.find((listToken) => listToken.list.title === VALIDATION_ERRORS_TITLE)

      if (errorsList) {
        if (!errorsList.list.items.includes(errorMessage)) {
          errorsList.list.items.push(errorMessage)
        }
      }
    } else {
      section = {
        title: extensionName,
        body: [
          {
            list: {
              title: VALIDATION_ERRORS_TITLE,
              items: [errorMessage],
            },
          },
        ],
      }
      sections.push(section)
    }

    // When the failure is a bundle size limit error, point at the exception request flow.
    const sizeLimitDetail = bundleSizeLimitDetail(error)
    if (sizeLimitDetail) {
      const sectionBody = section.body as ListToken[]
      const alreadyPresent = sectionBody.some((listToken) => listToken.list.title === BUNDLE_SIZE_EXCEPTION_TITLE)
      if (!alreadyPresent) {
        sectionBody.push(bundleSizeExceptionSection(sizeLimitDetail))
      }
    }

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
      } found in your extensions. Fix these issues and try deploying again.`,
    })) as ErrorCustomSection[]
}
