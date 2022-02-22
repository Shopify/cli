import {fileURLToPath} from 'url';

import {string, path, template, file, error} from '@shopify/cli-kit';

import {ExtensionTypes} from '../cli/constants';
import {load as loadApp, App} from '../cli/app/app';

async function getTemplatePath(name: string): Promise<string> {
  const templatePath = await path.findUp(`templates/${name}`, {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    type: 'directory',
  });
  if (templatePath) {
    return templatePath;
  } else {
    throw new error.Bug(`Couldn't find the template ${name} in @shopify/app.`);
  }
}

interface WriteFromTemplateOptions {
  promptAnswers: any;
  filename: string;
  alias?: string;
  log(message: string): void;
  directory: string;
}
async function writeFromTemplate({
  promptAnswers,
  filename,
  alias,
  directory,
  log,
}: WriteFromTemplateOptions) {
  const _alias = alias || filename;
  log(`Generating ${_alias} in ${directory}`);
  const templatePath = await getTemplatePath('extensions');
  const templateItemPath = path.join(templatePath, filename);
  const content = await file.read(templateItemPath);
  const contentOutput = await template(content)(promptAnswers);
  const fullpath = path.join(directory, _alias);
  await file.write(fullpath, contentOutput);
}

interface ExtensionInitOptions {
  name: string;
  extensionType: ExtensionTypes;
  parentApp: App;
  log(message: string): void;
}
async function extensionInit({
  name,
  extensionType,
  parentApp,
  log,
}: ExtensionInitOptions) {
  const hyphenizedName = string.hyphenize(name);
  const extensionDirectory = path.join(
    parentApp.directory,
    'extensions',
    hyphenizedName,
  );
  await file.mkdir(extensionDirectory);
  await Promise.all(
    [
      {filename: '.shopify.extension.toml'},
      {filename: `${extensionType}.jsx`, alias: 'index.jsx'},
    ].map((fileDetails) =>
      writeFromTemplate({
        ...fileDetails,
        log,
        directory: extensionDirectory,
        promptAnswers: {
          name,
          extensionType,
        },
      }),
    ),
  );
}

export default extensionInit;
