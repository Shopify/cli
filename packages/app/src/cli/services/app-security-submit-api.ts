import {uploadToGCS} from './bundle.js'
import {securitySubmitFailure} from './security-submit-result.js'
import type {AppSecuritySubmissionPayload} from './app-security-submission-payload.js'
import type {SecuritySubmitError, SubmitAppSecurityScanResult} from './security-submit-result.js'
import type {MinimalAppIdentifiers} from '../models/organization.js'
import type {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'

export interface SubmitAppSecurityScanOptions {
  app: MinimalAppIdentifiers
  payload: AppSecuritySubmissionPayload
  developerPlatformClient: DeveloperPlatformClient
}

interface SubmitAppSecurityScanDependencies {
  upload: typeof uploadToGCS
}

const defaultDependencies: SubmitAppSecurityScanDependencies = {upload: uploadToGCS}

function userErrorMessage(userErrors: {message: string}[], fallback: string): string {
  return userErrors.map(({message}) => message).join(', ') || fallback
}

export async function submitAppSecurityScan(
  options: SubmitAppSecurityScanOptions,
  dependencies: SubmitAppSecurityScanDependencies = defaultDependencies,
): Promise<SubmitAppSecurityScanResult> {
  let stage: SecuritySubmitError['stage'] = 'upload-url'
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
      artifactName: 'App Security submission',
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
              ? userErrorMessage(createResult.userErrors, 'Shopify could not create the App Security scan.')
              : 'Shopify did not accept the App Security submission.',
          userErrors: createResult.userErrors,
          accepted: createResult.accepted,
          tryMessage: 'Try submitting the App Security results again.',
        },
      }
    }
    return {status: 'submitted'}
  } catch (error) {
    const failure = securitySubmitFailure(error, stage)
    if (failure) return failure
    throw error
  }
}
