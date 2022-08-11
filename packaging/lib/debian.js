import {path, system} from '@shopify/cli-kit'

export async function packageDebian(packagingDir) {
  console.log(await system.captureOutput('pwd', [], {cwd: path.join(packagingDir, 'debian')}))
  await system.exec('dpkg-deb', ['-b', 'shopify-cli'], {cwd: path.join(packagingDir, 'debian')})
}
