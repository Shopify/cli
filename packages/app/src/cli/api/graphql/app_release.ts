interface ErrorDetail {
  extension_id: number
  extension_title: string
}

export interface AppReleaseSchema {
  appRelease: {
    appVersion: {
      versionTag?: string | null
      message?: string | null
      location: string
    }
    userErrors: {
      field?: string[] | null
      message: string
      category: string
      details: ErrorDetail[]
    }[]
  }
}
