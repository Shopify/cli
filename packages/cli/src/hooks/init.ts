import {Hook} from '@oclif/core'

const hook: Hook<'init'> = async (options) => {
  // const pluginList = Array.from(options.config.plugins.keys())
  // const hasHydrogenPlugin = pluginList.includes('@shopify/cli-hydrogen')
  // const isHydrogenCommand = options.id?.startsWith('hydrogen:')
  // const isInitCommand = options.id === 'hydrogen:init'
  // if (isHydrogenCommand && !hasHydrogenPlugin && !isInitCommand) {
  //   renderWarning({
  //     body: [
  //       `Looks like you're trying to run a Hydrogen command outside of a Hydrogen project.`,
  //       'Run',
  //       {command: 'shopify hydrogen init'},
  //       'to create a new Hydrogen project.',
  //     ],
  //   })
  //   process.exit()
  // }
}

export default hook
