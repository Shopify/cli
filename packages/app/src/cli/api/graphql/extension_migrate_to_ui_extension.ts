export interface MigrateToUiExtensionVariables {
  apiKey: string
  registrationId: string
}

export interface MigrateToUiExtensionSchema {
  migrateToUiExtension: {
    migratedToUiExtension: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
