import init from './init.js'
import {describe, expect, vi, test} from 'vitest'
import {renderTextPrompt} from '@shopify/cli-kit/node/ui'

vi.mock('@shopify/cli-kit/node/ui')

describe('init', () => {
  test('when name is not passed', async () => {
    const answers = {
      name: 'app',
    }
    const options = {template: 'template', directory: '/'}

    // Given
    vi.mocked(renderTextPrompt).mockResolvedValueOnce(answers.name)

    // When
    const got = await init(options)

    // Then
    expect(renderTextPrompt).toHaveBeenCalledWith({
      message: 'Your app project name?',
      defaultValue: expect.stringMatching(/^\w+-\w+-app$/),
      validate: expect.any(Function),
    })
    expect(got).toEqual({...options, ...answers})
  })

  test('when name is passed', async () => {
    const answers = {
      template: 'https://github.com/Shopify/shopify-app-template-node',
    }
    const options = {name: 'app', directory: '/'}

    // When
    const got = await init(options)

    // Then
    expect(renderTextPrompt).not.toHaveBeenCalled()
    expect(got).toEqual({...options, ...answers})
  })
})
