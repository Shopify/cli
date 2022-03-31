import askPrompts from './prompts'
import {configurationFileNames} from '../../constants'
import {describe, it, expect, vi} from 'vitest'
import {ui, file, path} from '@shopify/cli-kit'
import {temporary} from '@shopify/cli-testing'

describe('prompts', () => {
  it('prompts users for answers', async () => {
    const answers = {answer: 1}
    const promptSpy = vi.spyOn(ui, 'prompt').mockImplementation(async () => answers)

    const configurationContent1 = `
    [[prompts]]
    id = "hotdog"
    message = "Is a hot dog a sandwich?"
    type = "select"
    choices = ["Yes", "No", "Actually, it's a taco"]

    [[prompts]]
    id = "fruits"
    message = "What's your favorite fruit"
    type = "input"
    `
    const configurationContent2 = `
    [[prompts]]
    id = "hello"
    message = "Say hello"
    type = "input"
    `
    const prompts = [
      {
        id: 'hotdog',
        name: 'hotdog',
        message: 'Is a hot dog a sandwich?',
        type: 'select',
        choices: ['Yes', 'No', "Actually, it's a taco"],
      },
      {
        id: 'fruits',
        name: 'fruits',
        message: "What's your favorite fruit",
        type: 'input',
      },
      {
        id: 'hello',
        name: 'hello',
        message: 'Say hello',
        type: 'input',
      },
    ]

    await temporary.directory(async (tmpDir) => {
      await file.mkdir(path.join(tmpDir, '1'))
      const templateConfigurationFile1 = path.join(tmpDir, '1', configurationFileNames.homeTemplate)
      await file.write(templateConfigurationFile1, configurationContent1)

      await file.mkdir(path.join(tmpDir, '2'))
      const templateConfigurationFile2 = path.join(tmpDir, '2', configurationFileNames.homeTemplate)
      await file.write(templateConfigurationFile2, configurationContent2)

      const homeApp = await askPrompts(tmpDir)

      expect(promptSpy).toHaveBeenCalledWith(prompts.sort())
      expect(homeApp).toEqual(answers)
    })
  })
})
