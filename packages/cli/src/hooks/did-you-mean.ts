// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hook = async function (this: any, options: any) {
  const {DidYouMeanHook} = await import('@shopify/plugin-did-you-mean')
  return DidYouMeanHook.call(this, options)
}

export default hook
