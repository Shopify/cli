import {isValidURL} from '@shopify/cli-kit/common/url'
import {ui} from '@shopify/cli-kit'

export async function appUrlPrompt(defaultValue: string): Promise<string> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'App URL',
      default: defaultValue,
      validate: (value: string) => {
        if (isValidURL(value)) return true
        return 'Invalid URL'
      },
    },
  ])
  return input.url
}

export async function allowedRedirectionURLsPrompt(defaultValue: string): Promise<string[]> {
  const input = await ui.prompt([
    {
      type: 'input',
      name: 'urls',
      message: 'Allowed redirection URLs (comma separated)',
      default: defaultValue,
      validate: (value: string) => {
        if (value.split(',').every((url) => isValidURL(url))) return true
        return 'Invalid URLs'
      },
    },
  ])
  return input.urls.split(',')
}
