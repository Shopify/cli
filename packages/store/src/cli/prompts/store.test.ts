import {storeNamePrompt, storePlanPrompt} from './store.js'
import {describe, expect, test, vi} from 'vitest'
import {renderSelectPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

describe('storeNamePrompt', () => {
  test('asks for the store name and returns the entered value', async () => {
    vi.mocked(renderTextPrompt).mockResolvedValue('my-store')

    const result = await storeNamePrompt()

    expect(result).toBe('my-store')
    expect(renderTextPrompt).toHaveBeenCalledWith(
      expect.objectContaining({message: 'Name for the new development store'}),
    )
  })
})

describe('storePlanPrompt', () => {
  test('offers every plan handle and returns the selected value', async () => {
    vi.mocked(renderSelectPrompt).mockResolvedValue('advanced')

    const result = await storePlanPrompt()

    expect(result).toBe('advanced')
    expect(renderSelectPrompt).toHaveBeenCalledWith({
      message: 'Which Shopify plan do you want to use?',
      choices: [
        {label: 'Basic', value: 'basic'},
        {label: 'Grow', value: 'grow'},
        {label: 'Advanced', value: 'advanced'},
        {label: 'Plus', value: 'plus'},
      ],
    })
  })
})
