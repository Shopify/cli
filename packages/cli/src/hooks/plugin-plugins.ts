// eslint-disable-next-line @typescript-eslint/no-explicit-any
const hook = async function (this: any, options: any) {
  const pluginPlugins = await import('@oclif/plugin-plugins')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (pluginPlugins.hooks as any).call(this, options)
}

export default hook
