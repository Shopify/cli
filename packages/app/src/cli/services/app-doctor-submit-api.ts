import {uploadToGCS} from './bundle.js'
import {doctorSubmitFailure} from './doctor-submit-result.js'
import type {AppDoctorSubmissionPayload} from './app-doctor-submission-payload.js'
import type {DoctorSubmitError, SubmitAppDoctorScanResult} from './doctor-submit-result.js'
import type {MinimalAppIdentifiers} from '../models/organization.js'
import type {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'

export interface SubmitAppDoctorScanOptions {
  app: MinimalAppIdentifiers
  payload: AppDoctorSubmissionPayload
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
): Promise<SubmitAppDoctorScanResult> {
  let stage: DoctorSubmitError['stage'] = 'upload-url'
  try {
    const uploadResult = await options.developerPlatformClient.generateSourceScanUploadUrl({
      appId: options.app.id,
      byteSize: options.payload.bytes.length,
    })
    if (!uploadResult.sourceScanUploadUrl || uploadResult.userErrors.length > 0) {
      return {
        status: 'failed',
        error: {
          stage,
          message: userErrorMessage(uploadResult.userErrors, 'Shopify did not return a source scan upload URL.'),
          userErrors: uploadResult.userErrors,
        },
      }
    }

    stage = 'upload'
    await dependencies.upload(uploadResult.sourceScanUploadUrl, options.payload.bytes, {
      artifactName: 'App Doctor submission',
      contentType: 'application/json',
    })

    stage = 'create'
    const createResult = await options.developerPlatformClient.createSourceScan({
      appId: options.app.id,
      sourceScanUrl: uploadResult.sourceScanUploadUrl,
    })
    if (createResult.userErrors.length > 0 || !createResult.accepted) {
      return {
        status: 'failed',
        error: {
          stage,
          message:
            createResult.userErrors.length > 0
              ? userErrorMessage(createResult.userErrors, 'Shopify could not create the App Doctor scan.')
              : 'Shopify did not accept the App Doctor submission.',
          userErrors: createResult.userErrors,
          accepted: createResult.accepted,
          tryMessage: 'Try submitting the App Doctor results again.',
        },
      }
    }
    return {status: 'submitted'}
  } catch (error) {
    const failure = doctorSubmitFailure(error, stage)
    if (failure) return failure
    throw error
  }
}
