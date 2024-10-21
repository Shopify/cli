import {isPredefinedTemplate, templates, visibleTemplates} from '../../prompts/init/init.js'
import {safeParseURL} from '@shopify/cli-kit/common/url'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

export function validateTemplateValue(template: string | undefined) {
  if (!template) {
    return
  }

  const url = safeParseURL(template)
  if (url && url.origin !== 'https://github.com')
    throw new AbortError(
      'Only GitHub repository references are supported, ' +
        'e.g., https://github.com/Shopify/<repository>/[subpath]#[branch]',
    )
  if (!url && !isPredefinedTemplate(template))
    throw new AbortError(
      outputContent`Only ${visibleTemplates
        .map((alias) => outputContent`${outputToken.yellow(alias)}`.value)
        .join(', ')} template aliases are supported, please provide a valid URL`,
    )
}

export function validateFlavorValue(template: string | undefined, flavor: string | undefined) {
  if (!template) {
    if (flavor) {
      throw new AbortError(
        outputContent`The ${outputToken.yellow('--flavor')} flag requires the ${outputToken.yellow(
          '--template',
        )} flag to be set`,
      )
    } else {
      return
    }
  }

  if (!flavor) {
    return
  }

  if (!isPredefinedTemplate(template)) {
    throw new AbortError(
      outputContent`The ${outputToken.yellow('--flavor')} flag is not supported for custom templates`,
    )
  }

  const templateConfig = templates[template]

  if (!templateConfig.branches) {
    throw new AbortError(outputContent`The ${outputToken.yellow(template)} template does not support flavors`)
  }

  if (!templateConfig.branches.options[flavor]) {
    throw new AbortError(
      outputContent`Invalid option for ${outputToken.yellow('--flavor')}\nThe ${outputToken.yellow(
        '--flavor',
      )} flag for ${outputToken.yellow(template)} accepts only ${Object.keys(templateConfig.branches.options)
        .map((alias) => outputContent`${outputToken.yellow(alias)}`.value)
        .join(', ')}`,
    )
  }
}
