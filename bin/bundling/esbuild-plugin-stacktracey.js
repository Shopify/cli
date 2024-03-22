import { readFile } from 'fs/promises'

const ShopifyStacktraceyPlugin = {
  name: "ShopifyStacktraceyPlugin",
  setup(build) {
    // Stacktracey has a custom require implementation that doesn't work with esbuild
    build.onLoad({ filter: /.*stacktracey\.js/ }, async (args) => {
      const contents = await readFile(args.path, 'utf8')
      return { contents: contents.replaceAll('nodeRequire (', 'module.require(') }
    })
  }
}

export default ShopifyStacktraceyPlugin
