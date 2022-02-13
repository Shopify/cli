import {file, error, path, schema, toml} from '@shopify/cli-kit';

import {blocks, configurationFileNames, genericConfigurationFileNames} from '../constants';

const AppConfigurationSchema = schema.z.object({
  name: schema.z.string(),
});

type AppConfiguration = schema.z.infer<typeof AppConfigurationSchema>;

const UIExtensionConfigurationSchema = schema.z.object({
  name: schema.z.string(),
});

type UIExtensionConfiguration = schema.z.infer<
  typeof UIExtensionConfigurationSchema
>;

const ScriptConfigurationSchema = schema.z.object({
  name: schema.z.string(),
});

type ScriptConfiguration = schema.z.infer<typeof ScriptConfigurationSchema>;

interface Script {
  configuration: ScriptConfiguration;
  directory: string;
}

interface UIExtension {
  configuration: UIExtensionConfiguration;
  directory: string;
}

type PackageManager = "npm" | "yarn" | "pnpm"

interface App {
  directory: string;
  packageManager: PackageManager;
  configuration: AppConfiguration;
  scripts: Script[];
  uiExtensions: UIExtension[];
}

export async function load(directory: string): Promise<App> {
  if (!(await file.exists(directory))) {
    throw new error.Abort(`Couldn't find directory ${directory}`);
  }
  const configurationPath = path.join(directory, configurationFileNames.app);
  const configuration = await parseConfigurationFile(
    AppConfigurationSchema,
    configurationPath,
  );
  const scripts = await loadScripts(directory);
  const uiExtensions = await loadExtensions(directory);
  const yarnLockPath = path.join(directory, genericConfigurationFileNames.yarn.lockfile);
  const yarnLockExists = await file.exists(yarnLockPath);
  const pnpmLockPath = path.join(directory, genericConfigurationFileNames.pnpm.lockfile);
  const pnpmLockExists = await file.exists(pnpmLockPath);
  const packageManager = yarnLockExists ? 'yarn' :
    pnpmLockExists ? 'pnpm' :
    'npm';

  return {
    directory,
    configuration,
    scripts,
    uiExtensions,
    packageManager: packageManager,
  };
}

async function loadConfigurationFile(path: string): Promise<object> {
  if (!(await file.exists(path))) {
    throw new error.Abort(`Couldn't find the configuration file at ${path}`);
  }
  const configurationContent = await file.read(path);
  return toml.parse(configurationContent);
}

async function parseConfigurationFile(schema: any, path: string) {
  const configurationObject = await loadConfigurationFile(path);
  const parseResult = schema.safeParse(configurationObject);
  if (!parseResult.success) {
    throw new error.Abort(`Invalid schema in ${path}:\n${JSON.stringify(parseResult.error.issues)}`);
  }
  return parseResult.data;
}

async function loadExtensions(rootDirectory: string): Promise<UIExtension[]> {
  const extensionsPath = path.join(
    rootDirectory,
    `${blocks.uiExtensions.directoryName}/*`,
  );
  const directories = await path.glob(extensionsPath, {onlyDirectories: true});
  return Promise.all(
    directories.map(async (directory) => loadExtension(directory)),
  );
}

async function loadExtension(directory: string): Promise<UIExtension> {
  const configurationPath = path.join(
    directory,
    blocks.uiExtensions.configurationName,
  );
  const configuration = await parseConfigurationFile(
    UIExtensionConfigurationSchema,
    configurationPath,
  );
  return {directory, configuration};
}

async function loadScripts(rootDirectory: string): Promise<Script[]> {
  const scriptsPath = path.join(
    rootDirectory,
    `${blocks.scripts.directoryName}/*`,
  );
  const directories = await path.glob(scriptsPath, {onlyDirectories: true});
  return Promise.all(
    directories.map(async (directory) => loadScript(directory)),
  );
}

async function loadScript(directory: string): Promise<Script> {
  const configurationPath = path.join(
    directory,
    blocks.scripts.configurationName,
  );
  const configuration = await parseConfigurationFile(
    ScriptConfigurationSchema,
    configurationPath,
  );

  return {directory, configuration};
}
