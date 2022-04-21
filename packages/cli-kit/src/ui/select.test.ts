import {Select} from './select'
import {Question} from '../ui'
import {describe, expect, it, vi} from 'vitest'

class Prompt extends Select {
  constructor(options: any) {
    super({...options, show: false})
  }
}

describe('select', () => {
  it('runs the result callback with the default choice after submission', async () => {
    // Given
    const resultMock = vi.fn()
    const question = {
      type: 'select' as 'select',
      name: 'name',
      message: 'Name your new Hydrogen storefront',
      default: 'hydrogen-app',
      choices: ['hydrogen-app', 'snow-devil'],
      result: resultMock,
    }

    // When
    await createAndSubmitPrompt(question)

    // Then
    expect(resultMock).toHaveBeenCalledWith('hydrogen-app')
  })

  it('runs the result callback with the current choice after submission', async () => {
    // Given
    const resultMock = vi.fn()
    const question = {
      type: 'select' as 'select',
      name: 'name',
      message: 'Name your new Hydrogen storefront',
      default: 'hydrogen-app',
      choices: ['hydrogen-app', 'snow-devil'],
      result: resultMock,
    }

    // When
    await createAndSubmitPrompt(question, async (prompt: any) => {
      await prompt.keypress(null, {name: 'down'})
    })

    // Then
    expect(resultMock).toHaveBeenCalledWith('snow-devil')
  })
})

async function createAndSubmitPrompt(
  question: Question,
  run: (prompt: Prompt) => Promise<void> = () => Promise.resolve(),
) {
  const select: any = new Prompt(question)

  select.once('run', async () => {
    await run(select)
    await select.submit()
  })

  return select.run()
}
