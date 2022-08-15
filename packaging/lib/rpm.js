import {path, system} from '@shopify/cli-kit'

export async function packageRPM(packagingDir) {
  await system.exec('rpmbuild', ['-bb', 'shopify-cli.spec'], {
    cwd: path.join(packagingDir, 'rpm'),
  })
}
