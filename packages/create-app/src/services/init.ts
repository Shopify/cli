import {
  string,
  path,
  template,
  fs,
  output,
  version,
  os,
  ui,
  dependency,
} from '@shopify/cli-kit';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cliPackageVersion from '../../../cli/package.json';
import {template as getTemplatePath} from '../utils/paths';

interface InitOptions {
  name: string;
  description: string;
  directory: string;
}

async function init(options: InitOptions) {
  const user = (await os.username()) ?? '';
  const templatePath = await getTemplatePath('app');
  const cliVersion = cliPackageVersion.version;
  const outputDirectory = path.join(
    options.directory,
    string.hyphenize(options.name),
  );
  await ui.list([
    {
      title: 'Creating the app',
      task: async () => {
        return createApp({
          ...options,
          outputDirectory,
          templatePath,
          cliVersion,
          user,
        });
      },
    },
    {
      title: 'Installing dependencies',
      task: async () => {
        return installDependencies(outputDirectory);
      },
    },
  ]);
  output.success(
    output.content`App successfully created at ${output.token.path(
      outputDirectory,
    )}`,
  );
}

async function installDependencies(directory: string): Promise<void> {
  await dependency.install(
    directory,
    dependency.dependencyManagerUsedForCreating(),
  );
}

async function createApp(
  options: InitOptions & {
    outputDirectory: string;
    templatePath: string;
    cliVersion: string;
    user: string;
  },
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
    shopify_cli_version: options.cliVersion,
    author: options.user,
  };

  sortedTemplateFiles.forEach(async (templateItemPath) => {
    const outputPath = await template(
      path.join(
        options.outputDirectory,
        path.relative(options.templatePath, templateItemPath),
      ),
    )(templateData);
    if (fs.isDirectory(templateItemPath)) {
      await fs.mkdir(outputPath);
    } else {
      await fs.mkdir(path.dirname(outputPath));
      const content = await fs.readFile(templateItemPath);
      const contentOutput = await template(content)(templateData);
      await fs.write(outputPath, contentOutput);
    }
  });
}

export default init;

// TODO: Write unit tests for the service
// TODO: Write acceptance tests
