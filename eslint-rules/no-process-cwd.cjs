// When running a script using `npm run`, something interesting happens. If the current
// folder does not have a `package.json` or a `node_modules` folder, npm will traverse
// the directory tree upwards until it finds one. Then it will run the script and set
// `process.cwd()` to that folder, while the actual path is stored in the INIT_CWD
// environment variable (see here: https://docs.npmjs.com/cli/v9/commands/npm-run-script#description).

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow the use of `process.cwd()`',
    },
    schema: [],
    messages: {
      noProcessCwd: "Don't use process.cwd(); use path.cwd() from @shopify/cli-kit instead.",
    },
  },

  create(context) {
    return {
      "CallExpression > MemberExpression.callee[object.name = 'process'][property.name = 'cwd']"(node) {
        context.report({
          node: node.parent,
          messageId: 'noProcessCwd',
        })
      },
    }
  },
}
