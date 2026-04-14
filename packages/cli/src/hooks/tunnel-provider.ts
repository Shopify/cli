// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hook = async function (this: any, options: any) {
  const providerHook = await import('@shopify/plugin-cloudflare/hooks/provider')
  return providerHook.default.call(this, options)
}

export default hook
