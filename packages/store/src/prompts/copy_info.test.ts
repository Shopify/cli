import {renderCopyInfo} from './copy_info.js'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {describe, expect, vi, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

describe('renderCopyInfo', () => {
  test('renders info with headline and from/to details', () => {
    const headline = 'Copying data'
    const from = 'source-shop.myshopify.com'
    const to = 'target-shop.myshopify.com'

    renderCopyInfo(headline, from, to)

    expect(renderInfo).toHaveBeenCalledWith({
      headline,
      body: [{subdued: 'From:'}, from, {subdued: '\nTo:'}, to],
    })
  })
})
