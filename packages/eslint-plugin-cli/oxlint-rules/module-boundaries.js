const {existsSync, readFileSync, readdirSync} = require('node:fs')
const {dirname, join, resolve, relative, sep} = require('node:path')

const workspaces = new Map()
function projectsFor(filename) {
  let directory = dirname(filename)
  while (!existsSync(join(directory, 'pnpm-workspace.yaml'))) {
    const parent = dirname(directory)
    if (parent === directory) return []
    directory = parent
  }
  if (!workspaces.has(directory)) {
    const packages = join(directory, 'packages')
    const projects = readdirSync(packages, {withFileTypes: true})
      .filter((entry) => entry.isDirectory() && existsSync(join(packages, entry.name, 'project.json')))
      .map((entry) => ({
        root: join(packages, entry.name),
        name: JSON.parse(readFileSync(join(packages, entry.name, 'package.json'), 'utf8')).name,
      }))
    workspaces.set(directory, projects)
  }
  return workspaces.get(directory)
}
const contains = (root, filename) => {
  const path = relative(root, filename)
  return path !== '..' && !path.startsWith(`..${sep}`) && !path.startsWith(sep)
}

module.exports = {
  meta: {type: 'problem', schema: [{type: 'object'}]},
  create(context) {
    const filename = context.filename
    const projects = projectsFor(filename)
    const source = projects.find((project) => contains(project.root, filename))
    function check(node, literal) {
      if (!source || typeof literal?.value !== 'string') return
      const specifier = literal.value
      if (!specifier.startsWith('.')) return
      const target = projects.find((project) => contains(project.root, resolve(dirname(filename), specifier)))
      if (target && target !== source)
        context.report({
          node,
          message: `Import ${target.name} through its package name instead of a relative path between projects.`,
        })
    }
    return {
      ImportDeclaration(node) {
        check(node, node.source)
      },
      ExportNamedDeclaration(node) {
        check(node, node.source)
      },
      ExportAllDeclaration(node) {
        check(node, node.source)
      },
      ImportExpression(node) {
        check(node, node.source)
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') check(node, node.arguments[0])
      },
    }
  },
}
