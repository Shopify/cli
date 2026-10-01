const parser = require('@typescript-eslint/parser')

const parsedSources = new WeakMap()

function parserServices(sourceCode, filename, typeAware = false) {
  let parsed = parsedSources.get(sourceCode.ast)
  if (!parsed || (typeAware && !parsed.services.program)) {
    parsed = parser.parseForESLint(sourceCode.text, {
      sourceType: 'module',
      ecmaVersion: 'latest',
      filePath: filename,
      ...(typeAware ? {projectService: true, tsconfigRootDir: process.cwd()} : {}),
    })
    parsedSources.set(sourceCode.ast, parsed)
  }
  const nodesByRange = new Map()
  function indexNodes(node) {
    nodesByRange.set(`${node.type}:${node.range}`, node)
    for (const key of parsed.visitorKeys[node.type] ?? []) {
      const value = node[key]
      for (const child of Array.isArray(value) ? value : [value]) {
        if (child) indexNodes(child)
      }
    }
  }
  indexNodes(parsed.ast)
  const services = parsed.services
  const esTreeNodeToTSNodeMap = {
    get(node) {
      const parsedNode = nodesByRange.get(`${node.type}:${node.range}`)
      if (!parsedNode) throw new Error(`Unable to resolve TypeScript node ${node.type} in ${filename}`)
      return services.esTreeNodeToTSNodeMap.get(parsedNode)
    },
  }
  return {
    ...services,
    esTreeNodeToTSNodeMap,
    ...(services.program
      ? {
          getTypeAtLocation(node) {
            return services.program.getTypeChecker().getTypeAtLocation(esTreeNodeToTSNodeMap.get(node))
          },
          getSymbolAtLocation(node) {
            return services.program.getTypeChecker().getSymbolAtLocation(esTreeNodeToTSNodeMap.get(node))
          },
        }
      : {}),
  }
}

module.exports = {parserServices}
