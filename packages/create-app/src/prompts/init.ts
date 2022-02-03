import {ui} from '@shopify/cli-kit';

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
  const questions: ui.Question[] = [];
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'How would you like to name the app?',
    });
  }
  if (!options.description) {
    questions.push({
      type: 'input',
      name: 'description',
      message: "What's the application for?",
    });
  }
  return prompt(questions);
};

export default init;
