export interface RemoteSpecification {
  name: string
  externalName: string
  identifier: string
  gated: boolean
  externalIdentifier: string
  experience: 'extension' | 'configuration' | 'deprecated'
  managementExperience: 'cli' | 'custom' | 'dashboard'
  registrationLimit: number
  uidStrategy: 'single' | 'dynamic' | 'uuid'
  surface?: string
  validationSchema?: {
    jsonSchema: string
  } | null
}
