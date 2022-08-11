#!/usr/bin/env node

import {constants, http, output, path, system, template} from '@shopify/cli-kit';
import {createHash} from 'node:crypto';

output.initiateLogging();

const cliVersion = await constants.versions.cliKit();

async function tarballForPackage(pkg) {
  const response = await http.fetch(`https://registry.npmjs.com/${pkg}`);
  return (await response.json()).versions[cliVersion].dist.tarball;
}

async function sha256ForTarball(url) {
  const hash = createHash('sha256').setEncoding('hex');
  const response = await http.fetch(url);
  const stream = response.body.pipe(hash);
  await new Promise(resolve => stream.on("finish", resolve));
  return hash.read();
}

async function tarballAndShaForPackage(pkg) {
  const tarball = await tarballForPackage(pkg);
  const sha = await sha256ForTarball(tarball);
  return [tarball, sha];
}

const [
  [cliTarball, cliSha],
  [themeTarball, themeSha]
] = await Promise.all([
  tarballAndShaForPackage('@shopify/cli'),
  tarballAndShaForPackage('@shopify/theme')
]);

await template.recursiveDirectoryCopy(
  path.join(path.dirname(import.meta.url), '../packaging/homebrew').replace(/^file:/, ''),
  path.normalize(await system.captureOutput('/opt/dev/bin/dev', ['project-path', 'homebrew-shopify'])),
  {
    cliTarball,
    cliSha,
    themeTarball,
    themeSha,
  },
);
