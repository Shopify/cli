export interface AppVersionsQuerySchema {
  app: {
    id: string
    organizationId: string
    title: string
    appVersions: {
      nodes: {
        createdAt: string
        createdBy?: {
          displayName?: string | null
        }
        message?: string | null
        status: string
        versionTag?: string | null
      }[]
      pageInfo: {
        totalResults: number
      }
    }
  } | null
}
