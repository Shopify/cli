import {renderAsyncOperationStarted} from './async_operation_started.js'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {describe, expect, vi, test} from 'vitest'

vi.mock('@shopify/cli-kit/node/ui')

describe('renderAsyncOperationStarted', () => {
  test('calls renderOperationResult with correct base message', () => {
    const operation = 'Copy'
    const destination = 'shop1'
    const source = 'shop2'
    const id = '123'

    renderAsyncOperationStarted(operation, destination, source, id)

    expect(renderInfo).toHaveBeenCalledWith({
      headline: {info: `${operation} created`},
      body: [{subdued: 'From'}, destination, {subdued: '\nTo  '}, source, {subdued: '\nID  '}, id],
    })
  })
})
