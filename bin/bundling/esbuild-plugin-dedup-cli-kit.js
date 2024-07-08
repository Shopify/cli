const CliKitDedupPlugin = ({require}) => {
  return {
    name: 'CliKitDedupPlugin',
    setup(build) {
      // Resolve all imports of @shopify/cli-kit to the local dependency of the package.
      build.onResolve({filter: /@shopify\/cli-kit/}, (args) => {
        return {path: require.resolve(args.path)}
      })
    }
  }
}

export default CliKitDedupPlugin
