export interface UpdateURLsVariables {
  apiKey: string
  applicationUrl: string
  redirectUrlWhitelist: string[]
  appProxy?: {proxyUrl: string; proxySubPath: string; proxySubPathPrefix: string}
}

export interface UpdateURLsSchema {
  appUpdate: {
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
