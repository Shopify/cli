import {build as esBuild} from 'esbuild';
import {getConfigs} from './configs';

export interface Options {
  mode: 'development' | 'production';
}

export function build({mode}: Options) {
  const isDevelopment = mode === 'development';
  const {
    development: {entries, build = {}, serve = {}, buildDir},
  } = getConfigs();
  const {env = {}} = isDevelopment ? serve : build;
  const define = Object.keys(env || {}).reduce(
    (acc, key) => ({
      ...acc,
      [`process.env.${key}`]: JSON.stringify(env[key]),
    }),
    {'process.env.NODE_ENV': JSON.stringify(mode)},
  );

  esBuild({
    bundle: true,
    define,
    entryPoints: entries,
    loader: {
      '.esnext': 'ts',
      '.js': 'jsx',
    },
    logLevel: 'info',
    legalComments: 'linked',
    minify: !isDevelopment,
    outdir: buildDir,
    plugins: getPlugins(),
    target: 'es6',
    resolveExtensions: ['.tsx', '.ts', '.js', '.json', '.esnext', '.mjs', '.ejs'],
    watch: isDevelopment,
  }).catch((_e) => process.exit(1));
}

function getPlugins() {
  const plugins = [];

  if (graphqlAvailable()) {
    const {default: graphqlLoader} = require('@luckycatfactory/esbuild-graphql-loader');
    plugins.push(graphqlLoader());
  }

  return plugins;
}

function graphqlAvailable() {
  try {
    require.resolve('graphql') && require.resolve('graphql-tag');
    return true;
  } catch {
    return false;
  }
}
