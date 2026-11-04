import {type RenderAlertOptions} from '@shopify/cli-kit/node/ui'

export function devPreviewInfo(shopFqdn: string): RenderAlertOptions {
  return {
    headline: `A preview of your development changes is still available on ${shopFqdn}.`,
    body: ['Run', {command: 'shopify app dev clean'}, 'to restore the latest released version of your app.'],
    link: {
      label: 'Learn more about dev previews',
      url: 'https://shopify.dev/beta/developer-dashboard/shopify-app-dev',
    },
  }
}
