export function isUIExtension(extension: any): extension is ExtensionServer.UIExtension {
  return (
    extension.type === 'ui_extension' &&
    Array.isArray(extension.extensionPoints) &&
    extension.extensionPoints.every((extensionPoint: any) => typeof extensionPoint === 'object')
  )
}
