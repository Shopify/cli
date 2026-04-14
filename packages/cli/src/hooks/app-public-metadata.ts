// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hook = async function (this: any, options: any) {
  const {AppPublicMetadataHook} = await import('@shopify/app')
  return AppPublicMetadataHook.call(this, options)
}

export default hook
