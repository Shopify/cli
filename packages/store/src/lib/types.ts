export interface ResourceConfigs {
  [key: string]: ResourceConfig
}

export interface ResourceConfig {
  identifier: {
    field?: string
    customId?: {
      namespace: string
      key: string
    }
  }
}

export interface FlagOptions {
  [key: string]: unknown
}
