import type {PreviewThemeAppExtensionsOptions, DevProcessFunction} from './types.js'

export const runThemeAppExtensionServer: DevProcessFunction<PreviewThemeAppExtensionsOptions> = async (
  {stdout, stderr, abortSignal},
  {adminSession, themeExtensionServerArgs: args, storefrontToken, token},
) => {
  console.log('this is where the new http server will be')
}
