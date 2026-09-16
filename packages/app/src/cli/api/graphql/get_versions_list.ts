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
        versionId: string
        versionTag?: string | null
      }[]
      pageInfo: {
        totalResults: number
      }
    }
  } | null
}
