import {Writable} from 'stream';

import {
  string,
  path,
  template,
  file,
  output,
  os,
  ui,
  dependency,
} from '@shopify/cli-kit';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import cliPackage from '../../../cli/package.json';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import appPackage from '../../../app/package.json';
import {template as getTemplatePath} from '../utils/paths';

interface InitOptions {
  name: string;
  directory: string;
  dependencyManager: string | undefined;
  shopifyCliVersion: string | undefined;
  shopifyAppVersion: string | undefined;
}

async function init(options: InitOptions) {
  const user = (await os.username()) ?? '';
  const templatePath = await getTemplatePath('app');
  const cliPackageVersion = options.shopifyCliVersion ?? cliPackage.version;
  const appPackageVersion = options.shopifyAppVersion ?? appPackage.version;

  const dependencyManager = inferDependencyManager(options.dependencyManager);
  const hyphenizedName = string.hyphenize(options.name);
  const outputDirectory = path.join(options.directory, hyphenizedName);
  await ui.list(
    [
      {
        title: `Initializing your app ${hyphenizedName}`,
        task: async (_, task) => {
          await createApp({
            ...options,
            outputDirectory,
            templatePath,
            cliPackageVersion,
            appPackageVersion,
            user,
            dependencyManager,
          });
          task.title = 'Initialized';
        },
      },
      {
        title: `Installing dependencies with ${dependencyManager}`,
        task: async (_, task) => {
          const stdout = new Writable({
            write(chunk, encoding, next) {
              task.output = chunk.toString();
              next();
            },
          });
          await installDependencies(outputDirectory, dependencyManager, stdout);
        },
      },
    ],
    {concurrent: false},
  );

  output.message(output.content`
  ${hyphenizedName} is ready to build! ✨
    Docs: ${output.token.link(
      'Quick start guide',
      'https://shopify.dev/apps/getting-started',
    )}
    Inspiration ${output.token.command(`${dependencyManager} shopify help`)}
  `);
}

function inferDependencyManager(
  optionsDependencyManager: string | undefined,
): dependency.DependencyManager {
  if (
    optionsDependencyManager &&
    dependency.dependencyManager.includes(optionsDependencyManager)
  ) {
    return optionsDependencyManager as dependency.DependencyManager;
  }
  return dependency.dependencyManagerUsedForCreating();
}

async function installDependencies(
  directory: string,
  dependencyManager: dependency.DependencyManager,
  stdout: Writable,
): Promise<void> {
  await dependency.install(directory, dependencyManager, stdout);
}

async function createApp(
  options: InitOptions & {
    outputDirectory: string;
    templatePath: string;
    cliPackageVersion: string;
    appPackageVersion: string;
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
    shopify_cli_version: options.cliPackageVersion,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    shopify_app_version: options.appPackageVersion,
    author: options.user,
    dependencyManager: options.dependencyManager,
  };
  await Promise.all(
    sortedTemplateFiles.map(async (templateItemPath) => {
      const outputPath = await template(
        path.join(
          options.outputDirectory,
          path.relative(options.templatePath, templateItemPath),
        ),
      )(templateData);
      if (await file.isDirectory(templateItemPath)) {
        await file.mkdir(outputPath);
      } else {
        await file.mkdir(path.dirname(outputPath));
        const content = await file.read(templateItemPath);
        const contentOutput = await template(content)(templateData);
        await file.write(outputPath, contentOutput);
      }
    }),
  );
}

export default init;
