import {findPathUp, BugError} from '@shopify/core';

export async function template(name: string): Promise<string> {
  const templatePath = await findPathUp(
    `templates/${name}`,
    __dirname,
    'directory',
  );
  if (templatePath) {
    return templatePath;
  } else {
    throw new BugError(
      `Couldn't find the template ${name} in @shopify/create-app.`,
    );
  }
}
