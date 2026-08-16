export interface ExtensionRegistration {
  id: string
  uid?: string
  uuid: string
  title: string
  type: string
  draftVersion?: {
    config: string
    context?: string
  }
  activeVersion?: {
    config: string
    context?: string
  }
}

export interface RemoteExtensionRegistrations {
  extensionRegistrations: ExtensionRegistration[]
  configurationRegistrations: ExtensionRegistration[]
  dashboardManagedExtensionRegistrations: ExtensionRegistration[]
}

export interface AllAppExtensionRegistrationsQuerySchema {
  app: RemoteExtensionRegistrations
}
