import { readFile } from 'fs/promises'

const GraphiQLImportsPlugin = {
  name: 'GraphiQLImportsPlugin',
  setup(build) {
    // GraphiQL uses require.resolve with paths that won't work with esbuild
    // We need to replace them with valid paths
    // graphiql/server.ts uses require.resolve('@shopify/app/assets/...'). The bundled CLI does not ship
    // @shopify/app as a dependency; assets are copied to dist/assets. Rewrite to paths relative to bundled
    // command files under dist/cli/commands/** (e.g. app/dev.js -> ../../../assets/graphiql/...).
    build.onLoad({filter: /[/\\]graphiql[/\\]server\.[cm]?[jt]s$/}, async (args) => {
      const contents = await readFile(args.path, 'utf8')
      // When `contents` is returned, esbuild defaults the loader to `js` unless set — TypeScript would then
      // fail to parse (e.g. "Expected ')' but found ':'" on parameter type annotations).
      const loader = args.path.endsWith('.tsx') ? 'tsx' : 'ts'
      return {
        loader,
        contents: contents
          .replace('@shopify/app/assets/graphiql/favicon.ico', '../../../assets/graphiql/favicon.ico')
          .replace('@shopify/app/assets/graphiql/style.css', '../../../assets/graphiql/style.css'),
      }
    })
  },
}
export default GraphiQLImportsPlugin
