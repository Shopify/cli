import {Hook} from '@oclif/core'

const hook: Hook<'init'> = async function (options) {
  const hasHydrogenPlugin = options.config.plugins.some((plugin) => plugin.name === '@shopify/cli-hydrogen')
  const isHydrogenCommand = options.id?.startsWith('hydrogen:')
  if (isHydrogenCommand && !hasHydrogenPlugin) {
    console.log("Looks like you're trying to run a Hydrogen command outside of a Hydrogen project.")
    process.exit()
  }
}

export default hook
