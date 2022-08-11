import {path, system} from '@shopify/cli-kit'

export async function packageDebian(packagingDir, cliVersion) {
  console.log(await system.captureOutput('pwd', [], {cwd: path.join(packagingDir, 'debian')}))
  await system.exec('dpkg-deb', ['-b', 'shopify-cli', `shopify-cli-${cliVersion}.deb`], {cwd: path.join(packagingDir, 'debian')})
}
