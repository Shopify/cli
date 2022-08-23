import {ui} from '@shopify/cli-kit'

export const gitInit = async (): Promise<boolean> => {
  const question: ui.Question = {
    type: 'select',
    name: 'initialize',
    message: 'Directory is not git initialized, would you want to do this now?',
    choices: [
      {name: 'Yes', value: 'yes'},
      {name: 'No', value: 'no'},
    ],
    default: 'yes',
  }

  const promptResults = await ui.prompt([question])

  return promptResults.initialize === 'yes'
}
