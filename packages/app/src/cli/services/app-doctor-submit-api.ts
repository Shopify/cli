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
): Promise<void> {
  const uploadResult = await options.developerPlatformClient.generateSourceScanUploadUrl(options.app)
  if (!uploadResult.sourceScanUploadUrl || uploadResult.userErrors.length > 0) {
    throw new AbortError(userErrorMessage(uploadResult.userErrors, 'Shopify did not return a source scan upload URL.'))
  }

  await dependencies.upload(uploadResult.sourceScanUploadUrl, options.submissionPath, {
    artifactName: 'App Doctor submission',
    contentType: 'application/json',
  })

  const createResult = await options.developerPlatformClient.createSourceScan({
    appId: options.app.id,
    sourceScanUrl: uploadResult.sourceScanUploadUrl,
  })
  if (createResult.userErrors.length > 0) {
    throw new AbortError(userErrorMessage(createResult.userErrors, 'Shopify could not create the App Doctor scan.'))
  }
  if (!createResult.accepted) {
    throw new AbortError(
      'Shopify did not accept the App Doctor submission.',
      'Try submitting the App Doctor results again.',
    )
  }
}
