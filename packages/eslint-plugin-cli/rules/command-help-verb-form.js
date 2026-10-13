const {isCommandPath} = require('./command-path')

const imperativeVerbs = new Set([
  'access',
  'activate',
  'add',
  'apply',
  'authenticate',
  'build',
  'cancel',
  'check',
  'clean',
  'clear',
  'clone',
  'compile',
  'configure',
  'connect',
  'copy',
  'create',
  'delete',
  'deploy',
  'disable',
  'discuss',
  'display',
  'download',
  'duplicate',
  'enable',
  'execute',
  'fetch',
  'generate',
  'get',
  'import',
  'initialize',
  'install',
  'link',
  'list',
  'log',
  'login',
  'logout',
  'migrate',
  'move',
  'open',
  'package',
  'populate',
  'preview',
  'print',
  'process',
  'profile',
  'provide',
  'publish',
  'pull',
  'push',
  'query',
  'record',
  'refresh',
  'release',
  'remove',
  'rename',
  'replay',
  'reset',
  'retrieve',
  'return',
  'review',
  'run',
  'schedule',
  'search',
  'serve',
  'set',
  'share',
  'show',
  'start',
  'stop',
  'stream',
  'surface',
  'switch',
  'sync',
  'test',
  'trigger',
  'uninstall',
  'unschedule',
  'update',
  'upgrade',
  'upload',
  'use',
  'validate',
  'view',
  'watch',
])

// These starts introduce conditional, product-name, or explanatory copy, not an imperative verb.
const nonVerbStarts = new Set(['if', 'shopify', 'the', 'this'])

// Base forms such as "Pass" and "Focus" also end in s; their third-person forms end in "es".
const baseFormsEndingInS = new Set(['alias', 'bias', 'canvas'])
const isThirdPerson = (word) => word.endsWith('s') && !/(ss|us)$/.test(word) && !baseFormsEndingInS.has(word)

// Markdown help can start with a list, heading, or quote marker, or with emphasis around the first word.
const stripLeadingMarkdown = (text) =>
  text
    .trimStart()
    .replace(/^(?:(?:[-*+]|\d+[.)])\s+|#{1,6}\s+|>\s*)+/, '')
    .replace(/^(?:\*\*|__|\*|_)/, '')

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {description: 'check the first word of static command help for third-person verb form'},
    schema: [],
    messages: {
      imperative:
        'Start command help with a third-person verb, such as "Lists", not "{{verb}}". Reword non-verb copy or extend the non-verb allowlist.',
    },
  },
  create(context) {
    if (!isCommandPath(context.filename)) return {}

    return {
      ExportDefaultDeclaration(node) {
        if (node.declaration.type !== 'ClassDeclaration') return
        for (const member of node.declaration.body.body) {
          if (!member.static || member.computed || member.type !== 'PropertyDefinition') continue
          if (!['summary', 'description', 'descriptionWithMarkdown'].includes(member.key.name)) continue

          const value = member.value
          let text
          if (value?.type === 'Literal') text = value.value
          else if (value?.type === 'TemplateLiteral') {
            text = value.quasis[0].value.cooked
            if (value.expressions.length && !/^\[?[a-z]+[\s\].,!?:;()*_]/i.test(stripLeadingMarkdown(text))) continue
          }
          if (typeof text !== 'string') continue
          const verb = stripLeadingMarkdown(text).match(/^\[?([a-z]+)(?=[\s\].,!?:;()*_]|$)/i)?.[1]
          if (!verb) continue
          const firstWord = verb.toLowerCase()
          if (imperativeVerbs.has(firstWord) || (!isThirdPerson(firstWord) && !nonVerbStarts.has(firstWord))) {
            context.report({node: value, messageId: 'imperative', data: {verb}})
          }
        }
      },
    }
  },
}
