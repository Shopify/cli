import {isPredefinedTemplate, templates, visibleTemplates} from '../../prompts/init/init.js'
import {safeParseURL} from '@shopify/cli-kit/common/url'
import {AbortError} from '@shopify/cli-kit/node/error'

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
    throw new AbortError([
      'Only ',
      ...visibleTemplates.flatMap((alias, index) => [
        ...(index > 0 ? [', '] : []),
        {color: {text: alias, color: 'yellow'}},
      ]),
      ' template aliases are supported, please provide a valid URL',
    ])
}

export function validateFlavorValue(template: string | undefined, flavor: string | undefined) {
  if (!template) {
    if (flavor) {
      throw new AbortError([
        'The ',
        {color: {text: '--flavor', color: 'yellow'}},
        ' flag requires the ',
        {color: {text: '--template', color: 'yellow'}},
        ' flag to be set',
      ])
    } else {
      return
    }
  }

  if (!flavor) {
    return
  }

  if (!isPredefinedTemplate(template)) {
    throw new AbortError([
      'The ',
      {color: {text: '--flavor', color: 'yellow'}},
      ' flag is not supported for custom templates',
    ])
  }

  const templateConfig = templates[template]

  if (!templateConfig.branches) {
    throw new AbortError(['The ', {color: {text: template, color: 'yellow'}}, ' template does not support flavors'])
  }

  if (!templateConfig.branches.options[flavor]) {
    throw new AbortError([
      'Invalid option for ',
      {color: {text: '--flavor', color: 'yellow'}},
      '\nThe ',
      {color: {text: '--flavor', color: 'yellow'}},
      ' flag for ',
      {color: {text: template, color: 'yellow'}},
      ' accepts only ',
      ...Object.keys(templateConfig.branches.options).flatMap((alias, index) => [
        ...(index > 0 ? [', '] : []),
        {color: {text: alias, color: 'yellow'}},
      ]),
    ])
  }
}
