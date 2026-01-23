import {
  StagedUploadsCreate,
  StagedUploadsCreateMutation,
  StagedUploadsCreateMutationVariables,
} from '../../api/graphql/bulk-operations/generated/staged-uploads-create.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetch} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {renderSingleTask} from '@shopify/cli-kit/node/ui'

interface StageFileOptions {
  adminSession: AdminSession
  variablesJsonl?: string
}

export async function stageFile(options: StageFileOptions): Promise<string> {
  const {adminSession, variablesJsonl} = options

  const buffer = Buffer.from(variablesJsonl ?? '', 'utf-8')
  const filename = 'bulk-variables.jsonl'
  const size = buffer.length

  const response = await requestStagedUpload(adminSession, filename, size)
  const target = validateStagedUploadResponse(response)

  await uploadFileToStagedUrl(buffer, target.url, target.parameters, filename)

  return target.stagedUploadKey
}

async function requestStagedUpload(
  adminSession: AdminSession,
  filename: string,
  size: number,
): Promise<StagedUploadsCreateMutation> {
  return adminRequestDoc<StagedUploadsCreateMutation, StagedUploadsCreateMutationVariables>({
    query: StagedUploadsCreate,
    session: adminSession,
    variables: {
      input: [
        {
          filename,
          fileSize: size.toString(),
          httpMethod: 'POST',
          mimeType: 'text/jsonl',
          resource: 'BULK_MUTATION_VARIABLES',
        },
      ],
    },
  })
}

function validateStagedUploadResponse(response: StagedUploadsCreateMutation): {
  url: string
  resourceUrl: string
  parameters: {name: string; value: string}[]
  stagedUploadKey: string
} {
  if (!response.stagedUploadsCreate) {
    throw new AbortError('No response received from stagedUploadsCreate mutation')
  }

  if (response.stagedUploadsCreate.userErrors.length > 0) {
    const errors = response.stagedUploadsCreate.userErrors
      .map((error: {field?: string[] | null; message: string}) => error.message)
      .join(', ')
    throw new AbortError(`Failed to create staged upload: ${errors}`)
  }

  const target = response.stagedUploadsCreate.stagedTargets?.[0]
  if (!target) {
    throw new AbortError('No staged upload target returned from Shopify')
  }

  if (!target.url || !target.resourceUrl) {
    throw new AbortError('Invalid staged upload target: missing required URLs')
  }

  const stagedUploadKey = target.parameters.find((param) => param.name === 'key')?.value
  if (!stagedUploadKey) {
    throw new AbortError('No key parameter found in staged upload target')
  }

  return {
    url: target.url,
    resourceUrl: target.resourceUrl,
    parameters: target.parameters,
    stagedUploadKey,
  }
}

async function uploadFileToStagedUrl(
  fileContents: Buffer,
  uploadUrl: string,
  parameters: {name: string; value: string}[],
  filename: string,
): Promise<void> {
  const form = new FormData()

  for (const param of parameters) {
    form.append(param.name, param.value)
  }

  form.append('file', new Blob([fileContents], {type: 'text/jsonl'}), filename)

  const uploadResponse = await renderSingleTask({
    title: outputContent`Uploading bulk operation variables`,
    task: async () => {
      return fetch(
        uploadUrl,
        {
          method: 'POST',
          body: form,
        },
        'slow-request',
      )
    },
    renderOptions: {stdout: process.stderr},
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    throw new AbortError(`Failed to upload file to staged URL: ${uploadResponse.statusText}\n${errorText}`)
  }
}
