export interface MigrateFlowExtensionVariables {
  apiKey: string
  registrationId: string
}

export interface MigrateFlowExtensionSchema {
  migrateFlowExtension: {
    migratedFlowExtension: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
