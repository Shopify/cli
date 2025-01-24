export interface RemoteSpecification {
  name: string
  externalName: string
  identifier: string
  gated: boolean
  externalIdentifier: string
  experience: 'extension' | 'configuration' | 'deprecated'
  options: {
    managementExperience: 'cli' | 'custom' | 'dashboard'
    registrationLimit: number
  }
  features?: {
    argo?: {
      surface: string
    }
  }
  validationSchema?: {
    jsonSchema: string
  } | null
}

export interface FlattenedRemoteSpecification extends RemoteSpecification {
  surface?: string
  registrationLimit: number
}
