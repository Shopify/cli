export interface GraphiQLConfig {
  // Initial server data
  apiVersion: string
  apiVersions: string[]
  appName: string
  appUrl: string
  storeFqdn: string
  // Optional auth key
  key?: string

  // API endpoints
  baseUrl: string

  // Optional initial query state
  query?: string
  variables?: string

  // Default queries for tabs
  defaultQueries?: {
    query: string
    variables?: string
    preface?: string
  }[]
}

// Global config interface
declare global {
  interface Window {
    __GRAPHIQL_CONFIG__?: GraphiQLConfig
  }
}

export {}
