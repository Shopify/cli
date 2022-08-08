import {build as esBuild, BuildFailure, BuildResult, formatMessages} from 'esbuild';

import {getConfigs} from './configs';

export interface Options {
  mode: 'development' | 'production';
}

export function build({mode}: Options) {
  const isDevelopment = mode === 'development';
  const configs = getConfigs();
  const {
    development: {entries, build = {}, develop = {}, buildDir},
  } = configs;
  const {env = {}} = isDevelopment ? develop : build;
  const define = Object.keys(env || {}).reduce(
    (acc, key) => ({
      ...acc,
      [`process.env.${key}`]: JSON.stringify(env[key]),
    }),
    {'process.env.NODE_ENV': JSON.stringify(mode)},
  );

  let built = false;

  esBuild({
    bundle: true,
    define,
    entryPoints: entries,
    loader: {
      '.esnext': 'ts',
      '.js': 'jsx',
    },
    logLevel: isDevelopment ? 'silent' : 'info',
    legalComments: 'none',
    minify: !isDevelopment,
    outdir: buildDir,
    plugins: getPlugins(),
    target: 'es6',
    resolveExtensions: ['.tsx', '.ts', '.js', '.json', '.esnext', '.mjs', '.ejs'],
    watch: isDevelopment ? {onRebuild} : false,
  })
    .then((result) => {
      if (built) {
        return;
      }
      built = true;
      logResult(result);
    })
    .catch((_e) => {
      console.error('Error building extension: ', _e);
      process.exit(1);
    });
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
    // eslint-disable-next-line babel/no-unused-expressions
    require.resolve('graphql') && require.resolve('graphql-tag');
    return true;
  } catch {
    return false;
  }
}

async function onRebuild(failure: BuildFailure | null, _result: BuildResult | null) {
  if (failure) {
    console.error(failure.message);
  }
  logResult(failure);
}

async function logResult(result: BuildResult | null) {
  if (result?.errors.length || result?.warnings.length) {
    logErrors(result);
    return;
  }
  console.log(`Build succeeded`);
}

async function logErrors(result: BuildResult) {
  const errors = await formatMessages(result.errors, {kind: 'error'});
  const warnings = await formatMessages(result.warnings, {kind: 'warning'});
  if (errors.length > 0) console.error(errors.join('\n'));
  if (warnings.length > 0) console.error(errors.join('\n'));
}
