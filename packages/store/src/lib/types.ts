export interface ResourceConfigs {
  [key: string]: ResourceConfig
}

export interface ResourceConfig {
  identifier: ResourceConfigIdentifier
}

export interface ResourceConfigIdentifier {
  field?: string
  customId?: {
    namespace: string
    key: string
  }
}

export interface FlagOptions {
  [key: string]: unknown
}
