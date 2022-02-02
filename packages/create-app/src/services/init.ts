import {string, path, template, fs, system, output} from '@shopify/core';

import {cliVersion} from '../utils/versions';

interface InitOptions {
  name: string;
  description: string;
  directory: string;
  templatePath: string;
}

async function init(options: InitOptions) {
  const outputDirectory = path.join(
    options.directory,
    string.hyphenize(options.name),
  );
  console.log('Creating the app...');
  createApp({...options, outputDirectory});
  output.success(`App successfully created at ${outputDirectory}`);
}

async function createApp(
  options: InitOptions & {outputDirectory: string},
): Promise<void> {
  const templateFiles: string[] = await path.glob(
    path.join(options.templatePath, '**/*'),
  );
  // We sort them topologically to start creating
  // them from the most nested paths.
  const sortedTemplateFiles = templateFiles
    .map((path) => path.split('/'))
    .sort((lhs, rhs) => (lhs.length < rhs.length ? 1 : -1))
    .map((components) => components.join('/'));

  const templateData = {
    name: options.name,
    description: options.description,
    cliVersion,
  };

  sortedTemplateFiles.forEach(async (templateItemPath) => {
    const outputPath = await template(
      path.join(
        options.outputDirectory,
        path.relative(options.templatePath, templateItemPath),
      ),
    )(templateData);
    if (fs.isDirectory(templateItemPath)) {
      await system.mkdir(outputPath);
    } else {
      await system.mkdir(path.dirname(outputPath));
      const content = await fs.readFile(templateItemPath);
      const contentOutput = await template(content)(templateData);
      await fs.write(outputPath, contentOutput);
    }
  });
}

export default init;
