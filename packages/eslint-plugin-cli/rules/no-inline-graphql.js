// https://eslint.org/docs/developer-guide/working-with-rules
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const debug = require('debug')('eslint-plugin-cli:no-inline-graphql')

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
  const filePath = context.getFilename()
  const relativePath = path.relative(path.resolve(__dirname, '../../../../../../..'), filePath)
  const fileHash = hashFileSync(filePath)
  const shouldFail = !knownFailures[relativePath] || knownFailures[relativePath] !== fileHash

  if (shouldFail) {
    debug(`Reporting inline GraphQL tag fail for - '${relativePath}': '${fileHash}',`)
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
  const parents = context.getAncestors()
  parents.pop()
  const parent = parents.pop()
  if (parent.type === 'TaggedTemplateExpression' && parent.tag.name === 'gql') {
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
  'packages/app/src/cli/api/graphql/all_app_extension_registrations.ts':
    'bbde8b08d13bdeeab3d586ffd76c75cfea31c5891ac9a0f957a7a273d520e9e2',
  'packages/app/src/cli/api/graphql/all_dev_stores_by_org.ts':
    'f48a44e2dae39f1b33ac685971740e3705f2754de5fdf1d6f1fbb3492bc62be2',
  'packages/app/src/cli/api/graphql/app_active_version.ts':
    '685d858cf3ad636fe8d771707715dd9a793e4aa4529f843eac3df625efd4d5be',
  'packages/app/src/cli/api/graphql/app_deploy.ts': 'ff060a322caebf8722fc2f0e2e1cec08fbb861fb258af2417fc430006b2c903e',
  'packages/app/src/cli/api/graphql/app_release.ts': '3acace031157856c88dc57506d81364c084fb5ca66ab5c6ff59393ab5255846d',
  'packages/app/src/cli/api/graphql/app_version_by_tag.ts':
    'a3231389ceb20eec4cab51186678b032e52d8f3e4df3078ce1a33c8ae83ac7fa',
  'packages/app/src/cli/api/graphql/app_versions_diff.ts':
    '233e2abb837d4cad52e985b373784314129163bf530a6caa501af2b711717b09',
  'packages/app/src/cli/api/graphql/convert_dev_to_transfer_disabled_store.ts':
    '0261459f988f5ba947ba52dc90dd049032196595cad5be8b7042ad1d0a22277c',
  'packages/app/src/cli/api/graphql/create_app.ts': '13fdc528f39a5e6d589c7834e03f916528f00b431e69b8148c6237229be1dc2c',
  'packages/app/src/cli/api/graphql/current_account_info.ts':
    'e25977539cec28a33c0c32c75973ac5a78e3b4b5e504aa3d14d01291c5b42c14',
  'packages/app/src/cli/api/graphql/development_preview.ts':
    'db9e18b48c6cb6c76f8d03be74b902f8711c08d1512e26ed6e5884cafee62bfe',
  'packages/app/src/cli/api/graphql/extension_create.ts':
    'b6df36a09be710c98d49e4fe987fa77f92bafc91a8c1c0305d20f95d8bb013e8',
  'packages/app/src/cli/api/graphql/extension_migrate_app_module.ts':
    '8ec49d9639dd3eabec93caee1c8a0435a1be576c9115476199dfd7c382eacada',
  'packages/app/src/cli/api/graphql/extension_migrate_flow_extension.ts':
    '812944a456b2ae439ebb01a97c19e3e0c445157dd3578bc48b0a8c4cebb6e12e',
  'packages/app/src/cli/api/graphql/extension_migrate_to_ui_extension.ts':
    'dd3fb42d0b9327de627bd02295de9e08087266885777602a34b44bdc460c0285',
  'packages/app/src/cli/api/graphql/extension_specifications.ts':
    '9078c6fe4e0f48eea7d69e4253f1377fae58cc1ede4bd4f95b615d6b8b415b81',
  'packages/app/src/cli/api/graphql/find_app.ts': '699def43534d0fdb4988b91e74a890778026960fd31662fecd86384ecfc05370',
  'packages/app/src/cli/api/graphql/find_app_preview_mode.ts':
    '8311925b338d4aba1957974bb815cfa8c5d8272226f68b8e74a69d91acc9c8cb',
  'packages/app/src/cli/api/graphql/find_org.ts': 'f434cae80f3799cadc482ae22b0544c6f1d1171127943163d6e85e3a6b94c992',
  'packages/app/src/cli/api/graphql/find_org_basic.ts':
    '867f01113c20386d6a438dd56a6d241199e407eab928ab1ad9a7f233cd35c1be',
  'packages/app/src/cli/api/graphql/find_store_by_domain.ts':
    '0824f5baaab1ad419a7fa1d64824e306bd369430da47c7457ed72e74a1e94a9a',
  'packages/app/src/cli/api/graphql/functions/api_schema_definition.ts':
    '9ebbab831a66a2e49a8c2dac3185bb58c4688655040c6d14a9b2fb41a004bca8',
  'packages/app/src/cli/api/graphql/functions/target_schema_definition.ts':
    '0469c1fe724568f031a52c5bda54d56d8c3b23d7e8a54a86a684f72028d71b46',
  'packages/app/src/cli/api/graphql/generate_signed_upload_url.ts':
    '848e40bf6b44331de0fe1dc1b0753593c1d47f9705ebe988a1b8ad5638d267ef',
  'packages/app/src/cli/api/graphql/get_variant_id.ts':
    '805a7d8fb4b66ae23dc45cc37d401350c3d8eab4e262bd90e70afceb48be10de',
  'packages/app/src/cli/api/graphql/get_versions_list.ts':
    '36b6f90c6687ba50b84b31de9fa28b4e9d0cadb732cab6c0d83664b627f2969d',
  'packages/app/src/cli/api/graphql/subscribe_to_app_logs.ts':
    '47ba882dc6bb2487cf6d047aa1f4b45c2eed96017faf80af45f8f954017983bf',
  'packages/app/src/cli/api/graphql/template_specifications.ts':
    '7c9ce345b6cfce9292b7221e1b24205c3a3276495e0516da504de45c386567ae',
  'packages/app/src/cli/api/graphql/update_urls.ts': '37d20c418982a4bc4eed047ec48f52d93be1a0e59f1d905911b8519ab3adb5a4',
  'packages/app/src/cli/services/webhook/request-sample.ts':
    '05dd159152c528d7e785ef3476f6dbfca0be25046ce06584d5fd2ea89a23ed16',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/active-app-release.ts':
    'e1998153a015f9a7bb392aab6788a10a9afe76220eeb4515e958e679ec667ed1',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/app-version-by-id.ts':
    'd0ac3004b177cd97a8f289e67c1ec880df01f2e76816a170ae7718d72bd19e3f',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/app-versions.ts':
    'dc862433d890cb282832c726f1eea45bc73ff013b5d81ddede0c80d7e6ce9922',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/apps.ts':
    'f35782cdc5ced3259858d3ec17281ca34780e64cb6be627342817a69bfbdb00b',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/create-app-version.ts':
    'ec3aec2eeddaf2a9e9e14db04a8652f0d6fd168b74846e3f9212f357d54a97ff',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/create-app.ts':
    '48dd2aa539f0712d41ff3fb9674cc8fe279e131f3a8f95ad56f446cfc3e67d9d',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/create-asset-url.ts':
    '641e9973f085329b5a3ab3ba9e08106365d01cebceb9a9c0760debb82e4f2e82',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/organization.ts':
    '81aa51ec2465be18d8f184820c5965506074a3506865a0064bc3d49d7f4166dd',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/organization_beta_flags.ts':
    'feb27126f3f91bac7af3a6fdbd45b7b70e55c6b8f2e94d2200723baa3fccc3ba',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/release-version.ts':
    'f6302376a4d5b06f54caf774dbb9e7cc2a65f5513f23cca4392ddaad903917a1',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/specifications.ts':
    '431b569c1bcc2756ad3a16a0678525a3fdd5b9c7776b6f314bb8628ea2be537a',
  'packages/app/src/cli/utilities/developer-platform-client/app-management-client/graphql/user-info.ts':
    '8b7f642bb215b93f53a9eb90803a8f9ca8617a75dda8d51c21a06a7574722063',
  'packages/cli-kit/src/private/node/session.ts': '9081e73c91cb5d7cab7b45571ff2ff479ae71cf43672e8f13bda9a2541ff13c3',
  'packages/cli-kit/src/public/node/api/admin.ts': '2186080241b4ab29de8bd2f1176e077a1e71234baffb0802a15b0b82f887c9d1',
}
