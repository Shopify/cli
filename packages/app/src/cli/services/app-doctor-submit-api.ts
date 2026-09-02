import {uploadToGCS} from './bundle.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import type {AppDoctorSubmission} from './app-doctor-engine/submission/index.js'
import type {MinimalAppIdentifiers} from '../models/organization.js'
import type {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'

export interface SubmitAppDoctorScanOptions {
  app: MinimalAppIdentifiers
  submission: AppDoctorSubmission
  submissionPath: string
  developerPlatformClient: DeveloperPlatformClient
}

interface SubmitAppDoctorScanDependencies {
  upload: typeof uploadToGCS
}

const defaultDependencies: SubmitAppDoctorScanDependencies = {upload: uploadToGCS}

function userErrorMessage(userErrors: {message: string}[], fallback: string): string {
  return userErrors.map(({message}) => message).join(', ') || fallback
}

export async function submitAppDoctorScan(
  options: SubmitAppDoctorScanOptions,
  dependencies: SubmitAppDoctorScanDependencies = defaultDependencies,
): Promise<{id: string} | null> {
  const uploadResult = await options.developerPlatformClient.generateScanUploadUrl(options.app)
  if (!uploadResult.assetUrl || uploadResult.userErrors.length > 0) {
    throw new AbortError(userErrorMessage(uploadResult.userErrors, 'Shopify did not return a scan upload URL.'))
  }

  await dependencies.upload(uploadResult.assetUrl, options.submissionPath, {
    artifactName: 'App Doctor submission',
  })

  const createResult = await options.developerPlatformClient.createAppScan({
    appId: options.app.id,
    organizationId: options.app.organizationId,
    scanUrl: uploadResult.assetUrl,
    metadata: {
      ...(options.submission.metadata.version_tag === undefined
        ? {}
        : {versionTag: options.submission.metadata.version_tag}),
      ...(options.submission.metadata.source_control_url === undefined
        ? {}
        : {sourceControlUrl: options.submission.metadata.source_control_url}),
    },
  })
  if (createResult.userErrors.length > 0) {
    throw new AbortError(userErrorMessage(createResult.userErrors, 'Shopify could not create the App Doctor scan.'))
  }

  return createResult.scan
}
