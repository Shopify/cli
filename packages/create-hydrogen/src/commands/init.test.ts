import Init from './init.js'
import initService from '../services/init.js'
import initPrompt from '../prompts/init.js'
import {describe, it, expect, vi} from 'vitest'

vi.mock('../utils/paths')
vi.mock('../services/init')
vi.mock('../prompts/init')

const initServiceMock = vi.mocked(initService)
const initPromptMock = vi.mocked(initPrompt)

describe('Init', function () {
  it('initializes the template using the service', async function () {
    // Given
    const directory = '/path/to/output'
    const name = 'snow-devil'
    const template = 'demo-store'
    const language = 'js'
    initPromptMock.mockReturnValue(Promise.resolve({name, template, language}))

    // When
    await Init.run(['--name', name, '--path', directory, '--template', template])

    // Then
    expect(initServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name,
        directory,
        template,
      }),
    )
    expect(initPromptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name,
        template,
      }),
    )
  })
})
