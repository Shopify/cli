export function isUIExtension(extension: unknown): extension is ExtensionServer.UIExtension {
  const ext = extension as ExtensionServer.UIExtension
  return (
    ext.type === 'ui_extension' &&
    Array.isArray(ext.extensionPoints) &&
    ext.extensionPoints.every((extensionPoint: unknown) => typeof extensionPoint === 'object')
  )
}
