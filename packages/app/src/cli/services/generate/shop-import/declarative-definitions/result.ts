import {ImportDeclarativeDefinitionsResult} from './types.js'
import {outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'

export function renderImportDeclarativeDefinitionsResult({
  metafieldCount,
  metaobjectCount,
  storeDomain,
  tomlContent,
}: ImportDeclarativeDefinitionsResult) {
  renderInfo({
    headline: 'Conversion to TOML complete.',
    body: [
      'Converted',
      {
        warn: `${metafieldCount} metafields`,
      },
      'and',
      {
        warn: `${metaobjectCount} metaobjects`,
      },
      'from',
      {
        warn: storeDomain,
      },
      'into TOML, ready for you to copy.',
    ],
    orderedNextSteps: true,
    nextSteps: [
      'Review the suggested TOML carefully before applying.',
      [
        'Missing sections? Make sure your app has the required access scopes to load metafields and metaobjects (e.g.',
        {
          command: 'read_customers',
        },
        'to load customer metafields,',
        {
          command: 'read_metaobject_definitions',
        },
        'to load metaobjects.)',
      ],
      [
        'Missing definitions? Only metafields and metaobjects that are app-reserved (using',
        {
          command: '$app',
        },
        ') will be converted.',
      ],
      [
        "When you're ready, add the generated TOML to your app's configuration file and test out changes with the",
        {
          command: 'shopify app dev',
        },
        'command.',
      ],
    ],
  })

  renderTomlStringWithFormatting(tomlContent)
}

export function renderTomlStringWithFormatting(tomlContent: string) {
  const lines = tomlContent.split('\n')
  for (const line of lines) {
    if (line.match(/^\s*\[/)) {
      outputInfo(outputContent`${outputToken.green(line)}`)
    } else if (line.match(/^\s*#/)) {
      outputInfo(outputContent`${outputToken.gray(line)}`)
    } else {
      outputInfo(outputContent`${line}`)
    }
  }
}
