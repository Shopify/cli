import {load} from 'js-yaml';
import {readFileSync} from 'fs';

export interface CommandOptions {
  env?: {[key: string]: string};
}

export interface Configs {
  extensionPoints?: string[];
  entry: {[key: string]: string};
  outDir: string;
  build?: CommandOptions;
  serve?: CommandOptions;
  [key: string]: string | string[] | object;
}

const REQUIRED_CONFIGS = ['out_dir', 'entry'];

export function getConfigs() {
  try {
    const configs = load(readFileSync('shopifile.yml', 'utf8'));
    const jsonConfigs = Object.keys(configs).reduce(
      (acc, key) => ({
        ...acc,
        [toCamelCase(key)]: configs[key],
      }),
      {},
    );

    if (isValidConfig(jsonConfigs)) {
      return jsonConfigs;
    }
  } catch (e) {
    console.log(`Failed with error: ${e}`);
    process.exit(1);
  }
}

function toCamelCase(str) {
  return str.replace(/_./g, (x) => x.toUpperCase()[1]);
}

function isValidConfig(configs: any): configs is Configs {
  REQUIRED_CONFIGS.forEach((key) => {
    if (!configs[toCamelCase(key)]) {
      throw `Invalid configuration. Missing \`${key}\``;
    }
  });

  return true;
}
