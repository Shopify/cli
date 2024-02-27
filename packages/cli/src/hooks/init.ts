import {Hook} from '@oclif/core'
import {outputWarn} from '@shopify/cli-kit/node/output'

const hook: Hook<'init'> = async function (options) {
  const hasHydrogenPlugin = options.config.plugins.get('@shopify/cli-hydrogen') !== undefined
  const isHydrogenCommand = options.id?.startsWith('hydrogen:')
  const isInitCommand = options.id === 'hydrogen:init'
  if (isHydrogenCommand && !hasHydrogenPlugin && !isInitCommand) {
    outputWarn("⚠️ Looks like you're trying to run a Hydrogen command outside of a Hydrogen project.")
    process.exit()
  }
}

export default hook
