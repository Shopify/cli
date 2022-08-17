export interface DeployConfig {
  deploymentToken: string
  dmsAddress: string
  commitMessage?: string
  commitAuthor?: string
  commitSha?: string
  commitRef?: string
  timestamp?: string
  path?: string
}
export type ReqDeployConfig = Required<DeployConfig>

export interface DMSError {
  code: string
  unrecoverable: boolean
  debugInfo: string
}

export interface UploadDeploymentResponse {
  data: {
    uploadDeployment: {
      deployment: {
        previewURL: string
      }
    }
  }
}
