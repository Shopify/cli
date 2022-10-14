export interface DeployConfig {
  deploymentToken: string
  oxygenAddress: string
  healthCheck: boolean
  assumeYes: boolean
  path: string
  pathToBuild?: string
  commitMessage?: string
  commitAuthor?: string
  commitSha?: string
  commitRef?: string
  timestamp?: string
}
export type ReqDeployConfig = Required<DeployConfig>

export interface OxygenError {
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
      error: OxygenError
    }
  }
}

export interface GraphQLError {
  message: string
  extensions?: Map<string, unknown>
  locations: {
    line: number
    column: number
  }
}
