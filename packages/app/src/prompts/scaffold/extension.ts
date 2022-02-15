import {ui} from '@shopify/cli-kit';
import {extensions, ExtensionTypes} from '../../constants';

interface ScaffoldExtensionOptions {
  name?: string;
  type?: ExtensionTypes;
}

interface ScaffoldExtensionOutput {
  name: string;
  type: ExtensionTypes;
}

const scaffoldExtensionPrompt = async (
  options: ScaffoldExtensionOptions,
  prompt = ui.prompt,
): Promise<ScaffoldExtensionOutput> => {
  const questions: ui.Question[] = [];
  if (!options.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: "Your extensions's working name?",
      default: 'extension',
    });
  }
  if (!options.type) {
    questions.push({
      type: 'select',
      name: 'type',
      message: "Type of extension?",
      choices: extensions.types,
    });
  }
  const promptOutput: ScaffoldExtensionOutput = await prompt(questions);
  return {...options, ...promptOutput};
};

export default scaffoldExtensionPrompt;
