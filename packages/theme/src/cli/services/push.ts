import {mountThemeFileSystem} from '../utilities/theme-fs.js'
import {uploadTheme} from '../utilities/theme-uploader.js'
import {rejectGeneratedStaticAssets} from '../utilities/asset-checksum.js'
import {themeComponent} from '../utilities/theme-ui.js'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {fetchChecksums, publishTheme} from '@shopify/cli-kit/node/themes/api'
import {Result, Theme} from '@shopify/cli-kit/node/themes/types'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {themeEditorUrl, themePreviewUrl} from '@shopify/cli-kit/node/themes/urls'

interface PushOptions {
  path: string
  nodelete?: boolean
  json?: boolean
  force?: boolean
  publish?: boolean
  ignore?: string[]
  only?: string[]
}

interface JsonOutput {
  theme: {
    id: number
    name: string
    role: string
    shop: string
    editor_url: string
    preview_url: string
    warning?: string
  }
}

export async function push(theme: Theme, session: AdminSession, options: PushOptions) {
  const remoteChecksums = await fetchChecksums(theme.id, session)
  const themeFileSystem = await mountThemeFileSystem(options.path)
  const themeChecksums = rejectGeneratedStaticAssets(remoteChecksums)

  const results = await uploadTheme(theme, session, themeChecksums, themeFileSystem, options)

  if (options.publish) {
    await publishTheme(theme.id, session)
  }

  await handlePushOutput(results, theme, session, options)
}

function hasUploadErrors(results: Map<string, Result>): boolean {
  for (const [_key, result] of results.entries()) {
    if (!result.success) {
      return true
    }
  }
  return false
}

async function handlePushOutput(
  results: Map<string, Result>,
  theme: Theme,
  session: AdminSession,
  options: PushOptions,
) {
  const hasErrors = hasUploadErrors(results)

  if (options.json) {
    handleJsonOutput(theme, hasErrors, session)
  } else if (options.publish) {
    handlePublishOutput(hasErrors, session)
  } else {
    handleOutput(theme, hasErrors, session)
  }
}

function handleJsonOutput(theme: Theme, hasErrors: boolean, session: AdminSession) {
  const output: JsonOutput = {
    theme: {
      id: theme.id,
      name: theme.name,
      role: theme.role,
      shop: session.storeFqdn,
      editor_url: themeEditorUrl(theme, session),
      preview_url: themePreviewUrl(theme, session),
    },
  }

  if (hasErrors) {
    const message = `The theme ${themeComponent(theme).join(' ')} was pushed with errors`
    output.theme.warning = message
  }
  outputInfo(JSON.stringify(output))
}

function handlePublishOutput(hasErrors: boolean, session: AdminSession) {
  if (hasErrors) {
    renderWarning({body: `Your theme was published with errors and is now live at https://${session.storeFqdn}`})
  } else {
    renderSuccess({body: `Your theme is now live at https://${session.storeFqdn}`})
  }
}

function handleOutput(theme: Theme, hasErrors: boolean, session: AdminSession) {
  const nextSteps = [
    [
      {
        link: {
          label: 'View your theme',
          url: themePreviewUrl(theme, session),
        },
      },
    ],
    [
      {
        link: {
          label: 'Customize your theme at the theme editor',
          url: themeEditorUrl(theme, session),
        },
      },
    ],
  ]

  if (hasErrors) {
    renderWarning({
      body: ['The theme', ...themeComponent(theme), 'was pushed with errors'],
      nextSteps,
    })
  } else {
    renderSuccess({
      body: ['The theme', ...themeComponent(theme), 'was pushed successfully.'],
      nextSteps,
    })
  }
}
