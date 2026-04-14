// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hook = async function (this: any, options: any) {
  const tunnelHook = await import('@shopify/plugin-cloudflare/hooks/tunnel')
  return tunnelHook.default.call(this, options)
}

export default hook
