import {ui} from '@shopify/core';

interface InitOptions {
  name?: string;
  description?: string;
}

interface InitOutput {
  name: string;
  description: string;
}

const init = async (
  options: InitOptions,
  prompt = ui.prompt,
): Promise<InitOutput> => {
  return prompt([
    {
      type: 'input',
      name: 'name',
      message: 'How would you like to name the app?',
      when: () => !options.name,
    },
    {
      type: 'input',
      name: 'description',
      message: "What's the application for?",
      when: () => !options.description,
    },
  ]);
};

export default init;
