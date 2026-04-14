// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hook = async function (this: any, options: any) {
  const {AppSensitiveMetadataHook} = await import('@shopify/app')
  return AppSensitiveMetadataHook.call(this, options)
}

export default hook
