import { readFile } from 'fs/promises'

const createRequireStatement = /const require = createRequire\(import\.meta\.url\);?\r?\n/

const resolveGraphiQLAssetHelper = `function resolveGraphiQLAsset(asset) {
  const {existsSync} = require('node:fs')
  const {dirname, join, parse} = require('node:path')
  const {fileURLToPath} = require('node:url')

  for (
    let directory = dirname(fileURLToPath(import.meta.url));
    directory !== parse(directory).root;
    directory = dirname(directory)
  ) {
    const candidate = join(directory, 'assets', 'graphiql', asset)
    if (existsSync(candidate)) return candidate
  }

  return require.resolve(\`@shopify/cli-kit/assets/graphiql/\${asset}\`)
}
`

const GraphiQLImportsPlugin = {
  name: 'GraphiQLImportsPlugin',
  setup(build) {
    // GraphiQL uses require.resolve with paths that won't work with esbuild
    // We need to replace them with valid paths
    // graphiql/server.ts uses require.resolve('@shopify/cli-kit/assets/...'). The bundled CLI does not ship
    // @shopify/cli-kit as a dependency; assets are copied to dist/assets. Rewrite to a resolver that works whether
    // esbuild emits the GraphiQL server into a top-level shared chunk or a nested command file.
    build.onLoad({filter: /[/\\]graphiql[/\\]server\.[cm]?[jt]s$/}, async (args) => {
      const contents = await readFile(args.path, 'utf8')
      if (!createRequireStatement.test(contents)) {
        throw new Error(`Could not find the GraphiQL server createRequire statement in ${args.path}`)
      }
      // When `contents` is returned, esbuild defaults the loader to `js` unless set — TypeScript would then
      // fail to parse (e.g. "Expected ')' but found ':'" on parameter type annotations).
      const loader = args.path.endsWith('.tsx') ? 'tsx' : 'ts'
      return {
        loader,
        contents: contents
          .replace(createRequireStatement, (match) => `${match}\n${resolveGraphiQLAssetHelper}`)
          .replace("require.resolve('@shopify/cli-kit/assets/graphiql/favicon.ico')", "resolveGraphiQLAsset('favicon.ico')")
          .replace("require.resolve('@shopify/cli-kit/assets/graphiql/style.css')", "resolveGraphiQLAsset('style.css')"),
      }
    })
  },
}
export default GraphiQLImportsPlugin
