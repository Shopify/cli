import Init from './init'
import initService from '../services/init'
import initPrompt, {Template} from '../prompts/init'
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
    const template = Template.DemoStore

    initPromptMock.mockReturnValue(Promise.resolve({name, template}))

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
