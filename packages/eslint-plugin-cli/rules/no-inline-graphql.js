// https://eslint.org/docs/developer-guide/working-with-rules
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const debugEnabled = process.env.DEBUG && process.env.DEBUG.includes('eslint-plugin-cli')

/**
 * Check if using a gql`` template literal
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('estree').TaggedTemplateExpression} node
 */
function checkTaggedTemplateExpression(context, node) {
  const tagName = node.tag.name

  if (tagName !== 'gql') {
    return
  }

  const shouldFail = checkKnownFailuresIfShouldFail(context)

  if (shouldFail) {
    context.report(node, 'Forbidden inline GraphQL, use a separate file instead')
  }
}

function hashFileSync(filePath, algorithm = 'sha256') {
  const fileBuffer = fs.readFileSync(filePath)
  const hash = crypto.createHash(algorithm)
  hash.update(fileBuffer)
  return hash.digest('hex')
}

function checkKnownFailuresIfShouldFail(context) {
  const filePath = context.filename || context.getFilename()
  const relativePath = path.relative(path.resolve(__dirname, '../../../../../../..'), filePath)
  const fileHash = hashFileSync(filePath)
  const shouldFail = !knownFailures[relativePath] || knownFailures[relativePath] !== fileHash

  if (shouldFail) {
    if (debugEnabled) console.error(`eslint-plugin-cli:no-inline-graphql Reporting inline GraphQL tag fail for - '${relativePath}': '${fileHash}',`)
  }

  return shouldFail
}

/**
 * Check if using "mutation ... {" in a template string
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('estree').TemplateElement} node
 */
function checkTemplateElement(context, node) {
  // fail if contains "mutation" and "{"
  const fails = node.value.raw.includes('mutation') && node.value.raw.includes('{')

  if (!fails) {
    return
  }

  // don't fail if this is inside a TaggedTemplateExpression with gql tag name
  const sourceCode = context.sourceCode || context.getSourceCode()
  const parents = sourceCode.getAncestors(node)
  parents.pop()
  const parent = parents.pop()
  if (parent && parent.type === 'TaggedTemplateExpression' && parent.tag && parent.tag.name === 'gql') {
    return
  }

  const shouldFail = checkKnownFailuresIfShouldFail(context)
  if (shouldFail) {
    context.report(node, 'Forbidden inline GraphQL content, use a separate file instead')
  }
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "This rule blocks the use of inline GraphQL content in the codebase. It's recommended to use separate files and graphql-codegen instead.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          dynamic: {
            description: 'Allowed modules to import dynamically',
            type: 'array',
            items: {
              type: 'string',
            },
          },
          static: {
            description: 'Allowed modules to import statically',
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
      },
    ],
  },
  create(context) {
    return {
      TaggedTemplateExpression(node) {
        checkTaggedTemplateExpression(context, node)
      },
      TemplateElement(node) {
        checkTemplateElement(context, node)
      },
    }
  },
}

const knownFailures = {
  'packages/app/src/cli/api/graphql/extension_migrate_app_module.ts':
    '8ec49d9639dd3eabec93caee1c8a0435a1be576c9115476199dfd7c382eacada',
  'packages/app/src/cli/api/graphql/extension_migrate_flow_extension.ts':
    '812944a456b2ae439ebb01a97c19e3e0c445157dd3578bc48b0a8c4cebb6e12e',
  'packages/app/src/cli/api/graphql/extension_migrate_to_ui_extension.ts':
    'dd3fb42d0b9327de627bd02295de9e08087266885777602a34b44bdc460c0285',
  'packages/app/src/cli/api/graphql/get_variant_id.ts':
    '805a7d8fb4b66ae23dc45cc37d401350c3d8eab4e262bd90e70afceb48be10de',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/organization_beta_flags.ts':
    'feb27126f3f91bac7af3a6fdbd45b7b70e55c6b8f2e94d2200723baa3fccc3ba',
  'packages/cli-kit/src/private/node/session.ts': '9081e73c91cb5d7cab7b45571ff2ff479ae71cf43672e8f13bda9a2541ff13c3',
  'packages/cli-kit/src/public/node/api/admin.ts': '2186080241b4ab29de8bd2f1176e077a1e71234baffb0802a15b0b82f887c9d1',
}
