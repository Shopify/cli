import {isValidURL} from '@shopify/cli-kit/common/url'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

export async function appUrlPrompt(defaultValue: string): Promise<string> {
  return renderTextPrompt({
    message: 'App URL',
    defaultValue,
    validate: (value: string) => {
      if (!isValidURL(value)) return 'Invalid URL'
    },
  })
}

export async function allowedRedirectionURLsPrompt(defaultValue: string): Promise<string[]> {
  const urls = await renderTextPrompt({
    message: 'Allowed redirection URLs (comma separated)',
    defaultValue,
    validate: (value: string) => {
      if (!value.split(',').every((url) => isValidURL(url))) return 'Invalid URLs'
    },
  })
  return urls.split(',')
}

export async function appProxyUrlPrompt(defaultValue: string): Promise<string> {
  return renderTextPrompt({
    message: 'App Proxy URL',
    defaultValue,
    validate: (value: string) => {
      if (!isValidURL(value)) return 'Invalid URL'
    },
  })
}

export async function appProxyPathPrompt(defaultValue: string): Promise<string> {
  return renderTextPrompt({
    message: 'App Proxy Path',
    defaultValue,
    validate: (value: string) => {
      if (!value.match(/^[0-9a-z_-]+$/)) return 'Proxy Path can only contain letters, numbers, underscores or hyphens'
      if (value.length === 0) return 'Invalid URL'
    },
  })
}
