import {
  StagedUploadsCreate,
  StagedUploadsCreateMutation,
  StagedUploadsCreateMutationVariables,
} from '../../api/graphql/bulk-operations/generated/staged-uploads-create.js'
import {adminRequestDoc} from '@shopify/cli-kit/node/api/admin'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {readFile, fileSize} from '@shopify/cli-kit/node/fs'
import {basename} from '@shopify/cli-kit/node/path'
import {formData, fetch} from '@shopify/cli-kit/node/http'
import {AbortError} from '@shopify/cli-kit/node/error'

interface StageFileOptions {
  adminSession: AdminSession
  filePath?: string
  jsonVariables?: string
  filename?: string
}

export async function stageFile(options: StageFileOptions): Promise<string> {
  const {adminSession, filePath, jsonVariables, filename: providedFilename} = options

  const buffer = convertJsonToJsonlBuffer(jsonVariables)
  const filename = providedFilename ?? (filePath ? basename(filePath) : 'bulk-variables.jsonl')
  const size = await calculateFileSize(buffer, filePath)

  const response = await requestStagedUpload(adminSession, filename, size)
  const target = validateStagedUploadResponse(response)

  const fileContents = await prepareFileContents(buffer, filePath)
  await uploadFileToStagedUrl(fileContents, target.url, target.parameters, filename)

  return extractStagedUploadKey(target.parameters)
}

/**
 * Converts JSON variables string to JSONL buffer format
 */
function convertJsonToJsonlBuffer(jsonVariables?: string): Buffer | undefined {
  if (jsonVariables === undefined) {
    return undefined
  }

  const variablesArray: {[key: string]: unknown}[] = JSON.parse(jsonVariables)
  const jsonlContent = `${variablesArray.map((vars) => JSON.stringify(vars)).join('\n')}\n`
  return Buffer.from(jsonlContent, 'utf-8')
}

/**
 * Calculates the file size from buffer or file path
 */
async function calculateFileSize(buffer?: Buffer, filePath?: string): Promise<number> {
  if (buffer) {
    return buffer.length
  }
  if (filePath) {
    return fileSize(filePath)
  }
  return 0
}

/**
 * Requests a staged upload URL from Shopify
 */
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

/**
 * Validates the staged upload response and extracts the target
 */
function validateStagedUploadResponse(response: StagedUploadsCreateMutation): {
  url: string
  resourceUrl: string
  parameters: {name: string; value: string}[]
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

  // Type assertion: we've validated that url and resourceUrl are non-null strings
  return {
    url: target.url,
    resourceUrl: target.resourceUrl,
    parameters: target.parameters,
  }
}

/**
 * Prepares file contents for upload by reading from buffer or file path
 */
async function prepareFileContents(buffer?: Buffer, filePath?: string): Promise<Buffer> {
  if (buffer) {
    return buffer
  }

  if (filePath) {
    const fileData = await readFile(filePath)
    return typeof fileData === 'string' ? Buffer.from(fileData, 'utf-8') : fileData
  }

  return Buffer.alloc(0)
}

/**
 * Extracts the staged upload key from target parameters
 */
function extractStagedUploadKey(parameters: {name: string; value: string}[]): string {
  const stagedUploadKey = parameters.find((param) => param.name === 'key')?.value
  if (stagedUploadKey === undefined) {
    throw new AbortError('No key parameter found in target parameters')
  }
  return stagedUploadKey
}

async function uploadFileToStagedUrl(
  fileContents: Buffer,
  uploadUrl: string,
  parameters: {name: string; value: string}[],
  filename: string,
): Promise<void> {
  const form = formData()

  for (const param of parameters) {
    form.append(param.name, param.value)
  }

  form.append('file', fileContents, {
    filename,
    contentType: 'text/jsonl',
  })

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    body: form,
  })

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text()
    throw new AbortError(`Failed to upload file to staged URL: ${uploadResponse.statusText}\n${errorText}`)
  }
}
