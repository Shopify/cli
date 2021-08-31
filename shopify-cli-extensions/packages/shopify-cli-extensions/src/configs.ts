import {load} from 'js-yaml';
import {readFileSync} from 'fs';

export interface CommandOptions {
  env?: {[key: string]: string};
}

export interface Configs {
  development: Development;
  extensionPoints?: string[];
}

export interface Shopifile {
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

const REQUIRED_CONFIGS = {development: {build_dir: true, entries: {main: true}}};

export function getConfigs() {
  try {
    const configs = load(readFileSync('shopifile.yml', 'utf8'));
    if (!isValidConfigs(configs, REQUIRED_CONFIGS)) {
      throw new Error('Invalid configuration');
    }
    return jsonConfigs(configs);
  } catch (e) {
    console.log(`Failed with error: ${e}`);
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
): configs is Shopifile {
  Object.keys(requiredConfigs).forEach((key) => {
    console.log(`checking ${key}, ${requiredConfigs}, ${paths.join('.')}`);
    const value = configs[key];
    if (value === undefined || value === null) {
      throw `Invalid configuration. Missing \`${paths.concat(key).join('.')}\``;
    }
    if (!Array.isArray(value) && typeof value === 'object') {
      isValidConfigs(value, requiredConfigs[key] as RequiredConfigs, paths.concat(key));
    }
  }, {});
  return true;
}

function jsonConfigs<T extends Indexable>(configs: T): T {
  return Object.keys(configs).reduce((acc, key) => {
    const formattedKey = toCamelCase(key);
    const value = configs[key];
    if (Array.isArray(value) || typeof value !== 'object') {
      return {
        ...acc,
        [formattedKey]: configs[key],
      };
    }
    return {
      ...acc,
      [formattedKey]: jsonConfigs(value),
    };
  }, {} as T);
}
