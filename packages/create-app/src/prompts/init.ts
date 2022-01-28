import {prompt} from '@shopify/support';

interface InitPromptInput {
  name?: string;
  directory: string;
}

type InitPromptResponse = Required<InitPromptInput>;

async function init(input: InitPromptInput): Promise<InitPromptResponse> {
  const answers = await prompt.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'How would you like to name the app?',
      when: () => !input.name,
      transformer: (name: string) => name,
    },
  ]);
  return {name: answers.name, directory: input.directory};
}
export default init;
