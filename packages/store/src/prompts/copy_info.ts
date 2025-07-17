import {renderInfo} from '@shopify/cli-kit/node/ui'

export function renderCopyInfo(headline: string, from: string, to: string) {
  renderInfo({
    headline,
    body: [{subdued: 'From:'}, from, {subdued: '\nTo:  '}, to],
  })
}
