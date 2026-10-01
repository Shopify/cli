const {createRequire} = require('node:module')

const {builtinRules} = require('eslint/use-at-your-own-risk')
const typescriptParser = require('@typescript-eslint/parser')

const {parserServices} = require('./oxlint-typescript-services')
const shopifyRequire = createRequire(require.resolve('@shopify/eslint-plugin'))
const DisabledArea = shopifyRequire('eslint-plugin-eslint-comments/lib/internal/disabled-area')
const config = require('./config')

const plugins = Object.assign({}, ...config.map((entry) => entry.plugins))
plugins['@nx'] = require('@nx/eslint-plugin')
plugins.jsdoc = require('eslint-plugin-jsdoc')
plugins.react = require('eslint-plugin-react')

// Keep the upstream implementations and options while Oxlint owns parsing and traversal.
const ruleNames = Object.fromEntries([...builtinRules.keys()].map((name) => [name, name]))
const rules = Object.fromEntries(builtinRules)
for (const [pluginName, plugin] of Object.entries(plugins)) {
  for (const [ruleName, rule] of Object.entries(plugin.rules)) {
    const name = `${pluginName}/${ruleName}`.replaceAll('/', '-').replace('@', '')
    rules[name] = rule
    ruleNames[name] = `${pluginName}/${ruleName}`
  }
}

const directiveUsage = new WeakMap()

function usageFor(sourceCode) {
  let usage = directiveUsage.get(sourceCode.ast)
  if (!usage) {
    usage = {activeRules: new Set(), usedComments: new Set()}
    directiveUsage.set(sourceCode.ast, usage)
  }
  return usage
}

const settings = Object.assign({}, ...config.map((entry) => entry.settings))
for (const [name, rule] of Object.entries(rules)) {
  rules[name] = {
    ...rule,
    create(context) {
      const typed = name === 'typescript-eslint-no-unnecessary-type-assertion'
      const needsServices = typed || name === 'typescript-eslint-naming-convention'
      if (name === 'typescript-eslint-naming-convention' && context.options.some((option) => option.types?.length)) {
        throw new Error('Type-filtered naming conventions are not configured for this Oxlint adapter.')
      }
      const sourceCode = needsServices
        ? Object.create(context.sourceCode, {
            parserServices: {value: parserServices(context.sourceCode, context.filename, typed)},
          })
        : context.sourceCode
      const disabledAreas = DisabledArea.get(sourceCode).areas
      const usage = usageFor(sourceCode)
      usage.activeRules.add(ruleNames[name])
      const adaptedContext = Object.create(context, {
        sourceCode: {value: sourceCode},
        report: {
          value(descriptor, message) {
            const problem = message === undefined ? descriptor : {node: descriptor, message}
            const location = problem.loc?.start ?? problem.loc ?? problem.node.loc.start
            const disabled = disabledAreas.find(
              (area) =>
                (area.ruleId === null || area.ruleId === ruleNames[name]) &&
                (area.start.line < location.line ||
                  (area.start.line === location.line && area.start.column <= location.column)) &&
                (!area.end ||
                  area.end.line > location.line ||
                  (area.end.line === location.line && area.end.column >= location.column)),
            )
            if (disabled) usage.usedComments.add(disabled.comment)
            else context.report(problem)
          },
        },
        settings: {value: {...settings, ...context.settings, jsdoc: {mode: 'typescript', publicFunctionsOnly: true}}},
        languageOptions: {value: {...context.languageOptions, parser: typescriptParser}},
      })
      return rule.create(adaptedContext)
    },
  }
}

// The upstream rule patches ESLint's verifier. Oxlint owns verification, so track
// suppressions made by the adapters instead. Native directives are checked by Oxlint.
rules['eslint-comments-no-unused-disable'] = {
  meta: {type: 'problem', schema: [], messages: {unused: "Unused disable directive for '{{ruleId}}'."}},
  create(context) {
    return {
      'Program:exit'() {
        const usage = usageFor(context.sourceCode)
        for (const area of DisabledArea.get(context.sourceCode).areas) {
          if (area.ruleId && usage.activeRules.has(area.ruleId) && !usage.usedComments.has(area.comment)) {
            context.report({loc: area.comment.loc, messageId: 'unused', data: {ruleId: area.ruleId}})
          }
        }
      },
    }
  },
}

module.exports = {rules, ruleNames}
