import {readFileSync} from 'fs';

import {load} from 'js-yaml';

export interface CommandOptions {
  env?: {[key: string]: string};
}

export interface Configs {
  development: Development;
  extensionPoints?: string[];
}

export interface ConfigFile {
  development: Development;
  extension_points?: string[];
}

export interface Development {
  entries: {[key: string]: string};
  buildDir: string;
  build?: CommandOptions;
  serve?: CommandOptions;
}

interface RequiredConfigs {
  [key: string]: RequiredConfigs | boolean;
}

interface Indexable {
  [key: string]: any;
}

const REQUIRED_CONFIGS: RequiredConfigs = {
  development: {
    build_dir: true,
    entries: {main: true},
  },
};

const RESERVE_PATHS = flattenPaths({
  development: {
    build: {env: true},
    develop: {env: true},
  },
});

export function getConfigs() {
  const stdin = 0;

  try {
    const configs = load(readFileSync(stdin, 'utf8'));
    if (!isValidConfigs(configs, REQUIRED_CONFIGS)) {
      throw new Error('Invalid configuration');
    }
    return jsonConfigs(configs);
  } catch (error) {
    console.log(`Failed with error: ${error}`);
    process.exit(1);
  }
}

function toCamelCase(str: string) {
  return str.replace(/_./g, (substr: string) => substr.toUpperCase()[1]);
}

function isValidConfigs(
  configs: any,
  requiredConfigs: RequiredConfigs,
  paths: string[] = [],
): configs is ConfigFile {
  Object.keys(requiredConfigs).forEach((key) => {
    const isRequired = requiredConfigs[key] !== false;
    const value = configs[key];
    if ((value === undefined || value === null) && isRequired) {
      throw new Error(`Invalid configuration. Missing \`${paths.concat(key).join('.')}\``);
    }
    if (!Array.isArray(value) && typeof value === 'object') {
      isValidConfigs(value, requiredConfigs[key] as RequiredConfigs, paths.concat(key));
    }
  }, {});
  return true;
}

function jsonConfigs<T extends Indexable>(
  configs: T,
  paths: string[] = [],
  formatter = toCamelCase,
): T {
  return Object.keys(configs).reduce((acc, key) => {
    const shouldReserveKey = RESERVE_PATHS.includes(paths.concat(key).join('.'));
    const formattedKey = formatter(key);
    const value = configs[key];
    if (Array.isArray(value) || typeof value !== 'object') {
      return {
        ...acc,
        [formattedKey]: configs[key],
      };
    }
    return {
      ...acc,
      [formattedKey]: jsonConfigs(
        value,
        paths.concat(key),
        shouldReserveKey ? (key) => key : formatter,
      ),
    };
  }, {} as T);
}

function flattenPaths(config: RequiredConfigs, paths: string[] = []): string[] {
  return Object.keys(config).reduce((acc, key) => {
    const value = config[key];
    if (!value) {
      return acc;
    }
    if (typeof value === 'object') {
      return [...acc, ...flattenPaths(value, paths.concat(key))];
    }
    return [...acc, paths.concat(key).join('.')];
  }, [] as string[]);
}
