export interface HomeBundle {
  directory: string
  metadata: any
}

export interface UIExtensionBundle {
  directory: string
  metadata: any
}

export interface Bundle {
  appDirectory: string
  bundleDirectory: string
  // home: HomeBundle
  uiExtensions: UIExtensionBundle[]
}
