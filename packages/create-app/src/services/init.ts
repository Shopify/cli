import {
  string,
  path,
  template,
  fs,
  output,
  os,
  ui,
  dependency,
} from '@shopify/cli-kit';
import {DependencyManager} from '@shopify/cli-kit/src/dependency';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import cliPackageVersion from '../../../cli/package.json';
import {template as getTemplatePath} from '../utils/paths';

interface InitOptions {
  name: string;
  directory: string;
}

async function init(options: InitOptions) {
  const user = (await os.username()) ?? '';
  const templatePath = await getTemplatePath('app');
  const cliVersion = cliPackageVersion.version;
  const dependencyManager = dependency.dependencyManagerUsedForCreating();
  const outputDirectory = path.join(
    options.directory,
    string.hyphenize(options.name),
  );
  await ui.list([
    {
      title: 'Initiated',
      task: async () => {
        return createApp({
          ...options,
          outputDirectory,
          templatePath,
          cliVersion,
          user,
          dependencyManager,
        });
      },
    },
    {
      title: 'Installing dependencies',
      task: async () => {
        return installDependencies(outputDirectory, dependencyManager);
      },
    },
  ]);
  output.message(output.content`
  ${string.hyphenize(options.name)} is ready to build! ✨
    Docs: ${output.token.link(
      'Quick start guide',
      'https://shopify.dev/apps/getting-started',
    )}
    Inspiration ${output.token.command(`${dependencyManager} shopify help`)}
  `);
}

async function installDependencies(
  directory: string,
  dependencyManager: DependencyManager,
): Promise<void> {
  await dependency.install(directory, dependencyManager);
}

async function createApp(
  options: InitOptions & {
    outputDirectory: string;
    templatePath: string;
    cliVersion: string;
    user: string;
    dependencyManager: string;
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
    // eslint-disable-next-line @typescript-eslint/naming-convention
    shopify_cli_version: options.cliVersion,
    author: options.user,
    dependencyManager: options.dependencyManager,
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
