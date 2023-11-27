import {AdminSession} from '@shopify/cli-kit/node/session'
import {LocalTheme, Theme} from '@shopify/cli-kit/node/themes/models/index'
import {fetchChecksums} from '@shopify/cli-kit/node/themes/themes-api'

export async function downloadTheme(theme: Theme, localTheme: LocalTheme, session: AdminSession) {
  const checksums = await fetchChecksums(theme.id, session)

  // console.log(theme)
  // console.log(localTheme)

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  checksums.forEach(async (ccc) => {
    // eslint-disable-next-line no-console
    console.log(ccc.key, '>', ccc.checksum)
  })

  // const localChecksum = checksums.filter((eee) => eee.key === 'sections/footer-group.json').at(0)!

  // // eslint-disable-next-line no-console
  // console.log('remote >> ', localChecksum.key, localChecksum.checksum)

  // download file
  // const key = checksums[0]?.key!
  // const themeAsset = await fetchThemeAsset(theme.id, key, session)
  // save on FS
}
