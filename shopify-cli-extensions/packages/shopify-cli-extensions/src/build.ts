import {build as esBuild} from 'esbuild';
import {getConfigs} from './configs';

export function build({mode}) {
  const isDevelopment = mode === 'development';
  const {entry, build = {}, serve = {}, outDir} = getConfigs();
  const commandConfigs = isDevelopment ? serve : build;
  const define = Object.keys(commandConfigs).reduce(
    (acc, key) => ({
      ...acc,
      [`process.env.${key}`]: JSON.stringify(commandConfigs[key]),
    }),
    {'process.env.NODE_ENV': JSON.stringify(mode)},
  );

  esBuild({
    bundle: true,
    define,
    entryPoints: entry,
    loader: {
      '.esnext': 'ts',
      '.js': 'jsx',
    },
    logLevel: 'info',
    legalComments: 'linked',
    minify: !isDevelopment,
    outdir: outDir,
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
