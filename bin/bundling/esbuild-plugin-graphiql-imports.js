import { readFile } from 'fs/promises'

const GraphiQLImportsPlugin = {
  name: 'GraphiQLImportsPlugin',
  setup(build) {
    // GraphiQL uses require.resolve with paths that won't work with esbuild
    // We need to replace them with valid paths
    build.onLoad({filter: /.*server\.js/}, async (args) => {
      const contents = await readFile(args.path, 'utf8')
      return {
        contents: contents
          .replace('@shopify/app/assets/graphiql/favicon.ico', './assets/graphiql/favicon.ico')
          .replace('@shopify/app/assets/graphiql/style.css', './assets/graphiql/style.css'),
      }
    })
  },
}
export default GraphiQLImportsPlugin
