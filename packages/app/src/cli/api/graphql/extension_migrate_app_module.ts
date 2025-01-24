export interface MigrateAppModuleVariables {
  apiKey: string
  registrationId: string
  type: string
}

export interface MigrateAppModuleSchema {
  migrateAppModule: {
    migratedAppModule: boolean
    userErrors: {
      field: string[]
      message: string
    }[]
  }
}
