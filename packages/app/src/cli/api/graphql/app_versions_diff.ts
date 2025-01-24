export interface AppVersionsDiffExtensionSchema {
  uuid: string
  registrationTitle: string
  specification: {
    identifier: string
    experience: string
    options: {
      managementExperience: string
    }
  }
}

export interface AppVersionsDiffSchema {
  app: {
    versionsDiff: {
      added: AppVersionsDiffExtensionSchema[]
      updated: AppVersionsDiffExtensionSchema[]
      removed: AppVersionsDiffExtensionSchema[]
    }
  }
}
