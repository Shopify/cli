export interface StagedUploadInput {
  resource: string
  filename: string
  mimeType: string
  httpMethod: string
  fileSize?: string
}

export interface StagedUploadResponse {
  stagedUploadsCreate: {
    stagedTargets: {
      url: string
      resourceUrl: string
      parameters: {
        name: string
        value: string
      }[]
    }[]
    userErrors: {
      field: string
      message: string
    }[]
  }
}
