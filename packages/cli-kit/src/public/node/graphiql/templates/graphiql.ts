import {platformAndArch} from '../../os.js'
import {MUTATIONS_BLOCKED_MESSAGE} from '../server.js'

const controlKey = platformAndArch().platform === 'darwin' ? 'MAC_COMMAND_KEY' : 'Ctrl'

const graphiqlIntroMessage = `
# Welcome to GraphiQL for the Shopify Admin API! If you've used
# GraphiQL before, you can jump to the next tab.
#
# GraphiQL is an in-browser tool for writing, validating, and
# testing GraphQL queries.
#
# Type queries into this side of the screen, and you will see intelligent
# typeaheads aware of the current GraphQL type schema and live syntax and
# validation errors highlighted within the text.
#
# GraphQL queries typically start with a "{" character. Lines that start
# with a # are ignored.
#
# Keyboard shortcuts:
#
#   Prettify query:  Shift-${controlKey}-P (or press the prettify button)
#
#  Merge fragments:  Shift-${controlKey}-M (or press the merge button)
#
#        Run Query:  ${controlKey}-Enter (or press the play button)
#
#    Auto Complete:  ${controlKey}-Space (or just start typing)
#
`

export const defaultQuery = `query shopInfo {
  shop {
    name
    url
    myshopifyDomain
    plan {
      displayName
      partnerDevelopment
      shopifyPlus
    }
  }
}
`.replace(/\n/g, '\\n')

interface GraphiQLTemplateOptions {
  apiVersion: string
  apiVersions: string[]
  appName?: string
  appUrl?: string
  key: string
  storeFqdn: string
  protectMutations?: boolean
}

// Escapes a value the same way react-dom's renderToStaticMarkup escaped it when
// the markup below was produced by rendering Polaris components.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// The HTML chunks below are the exact static markup that rendering the previous
// Polaris/React components with renderToStaticMarkup produced, with the dynamic
// values interpolated where the components received props.
const topBarOpenHtml = `<div id="top-bar"><div class="Polaris-Box" style="--pc-box-background:var(--p-color-bg-surface);--pc-box-padding-block-start-xs:var(--p-space-400);--pc-box-padding-block-end-xs:var(--p-space-400);--pc-box-padding-inline-start-xs:var(--p-space-400);--pc-box-padding-inline-end-xs:var(--p-space-400)"><div class="Polaris-BlockStack" style="--pc-block-stack-order:column;--pc-block-stack-gap-xs:var(--p-space-300)"><div class="Polaris-Grid" style="--pc-grid-columns-xs:3;--pc-grid-columns-sm:3;--pc-grid-columns-md:3"><div class="Polaris-Grid-Cell Polaris-Grid-Cell--cell_3ColumnXs Polaris-Grid-Cell--cell_3ColumnSm Polaris-Grid-Cell--cell_3ColumnMd Polaris-Grid-Cell--cell_7ColumnLg Polaris-Grid-Cell--cell_7ColumnXl"><div class="Polaris-InlineStack" style="--pc-inline-stack-wrap:wrap;--pc-inline-stack-gap-xs:var(--p-space-400);--pc-inline-stack-flex-direction-xs:row">`

function statusBadgesHtml(unauthorizedLabel: string): string {
  return `<div id="status-badge" class="top-bar-section"><div class="status-badge-option" id="status-badge-running"><span class="top-bar-section-title">Status: </span><span class="Polaris-Badge Polaris-Badge--toneSuccess"><span class="Polaris-Badge__Icon"><span class="Polaris-Icon"><svg viewBox="0 0 20 20"><path d="M6 10c0-.93 0-1.395.102-1.776a3 3 0 0 1 2.121-2.122C8.605 6 9.07 6 10 6c.93 0 1.395 0 1.776.102a3 3 0 0 1 2.122 2.122C14 8.605 14 9.07 14 10s0 1.395-.102 1.777a3 3 0 0 1-2.122 2.12C11.395 14 10.93 14 10 14s-1.395 0-1.777-.102a3 3 0 0 1-2.12-2.121C6 11.395 6 10.93 6 10Z"></path></svg></span></span><span class="Polaris-Text--root Polaris-Text--bodySm">Running</span></span></div><div class="status-badge-option with-shrunk-icon" id="status-badge-unauthorized"><span class="top-bar-section-title">Status: </span><span class="Polaris-Badge Polaris-Badge--toneAttention"><span class="Polaris-Badge__Icon"><span class="Polaris-Icon"><svg viewBox="0 0 20 20" class="Polaris-Icon__Svg" focusable="false" aria-hidden="true"><path d="M10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75Z"></path><path d="M11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"></path><path fill-rule="evenodd" d="M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-1.5 0a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Z"></path></svg></span></span><span class="Polaris-Text--root Polaris-Text--bodySm">${escapeHtml(unauthorizedLabel)}</span></span></div><div class="status-badge-option with-shrunk-icon" id="status-badge-disconnected"><span class="top-bar-section-title">Status: </span><span class="Polaris-Badge Polaris-Badge--toneCritical"><span class="Polaris-Badge__Icon"><span class="Polaris-Icon"><svg viewBox="0 0 20 20" class="Polaris-Icon__Svg" focusable="false" aria-hidden="true"><path fill-rule="evenodd" d="M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-3.677 4.383a5.5 5.5 0 0 1-7.706-7.706l7.706 7.706Zm1.06-1.06-7.706-7.706a5.5 5.5 0 0 1 7.706 7.706Z"></path></svg></span></span><span class="Polaris-Text--root Polaris-Text--bodySm">Disconnected</span></span></div></div>`
}

function versionSelectHtml(apiVersions: string[], apiVersion: string): string {
  const options = apiVersions
    .map(
      (version) =>
        `<option value="${escapeHtml(version)}"${version === apiVersion ? ' selected=""' : ''}>${escapeHtml(
          version,
        )}</option>`,
    )
    .join('')
  return `<div id="version-select" class="top-bar-section"><span class="top-bar-section-title">API version: </span><div class="Polaris-Labelled--hidden"><div class="Polaris-Labelled__LabelWrapper"><div class="Polaris-Label"><label id="_R_2im_Label" for="_R_2im_" class="Polaris-Label__Text"><span class="Polaris-Text--root Polaris-Text--bodyMd">API version</span></label></div></div><div class="Polaris-Select"><select id="_R_2im_" class="Polaris-Select__Input" aria-invalid="false">${options}</select><div class="Polaris-Select__Content" aria-hidden="true"><span class="Polaris-Select__SelectedOption">${escapeHtml(apiVersion)}</span><span class="Polaris-Select__Icon"><span class="Polaris-Icon"><svg viewBox="0 0 20 20" class="Polaris-Icon__Svg" focusable="false" aria-hidden="true"><path d="M10.884 4.323a1.25 1.25 0 0 0-1.768 0l-2.646 2.647a.75.75 0 0 0 1.06 1.06l2.47-2.47 2.47 2.47a.75.75 0 1 0 1.06-1.06l-2.646-2.647Z"></path><path d="m13.53 13.03-2.646 2.647a1.25 1.25 0 0 1-1.768 0l-2.646-2.647a.75.75 0 0 1 1.06-1.06l2.47 2.47 2.47-2.47a.75.75 0 0 1 1.06 1.06Z"></path></svg></span></span></div><div class="Polaris-Select__Backdrop"></div></div></div></div>`
}

function linkPillHtml(url: string, label: string): string {
  return `<a target="_blank" class="Polaris-Link" href="${escapeHtml(url)}" rel="noopener noreferrer" data-polaris-unstyled="true"><span class="Polaris-Badge Polaris-Badge--toneInfo"><span class="Polaris-Badge__Icon"><span class="Polaris-Icon"><svg viewBox="0 0 20 20" class="Polaris-Icon__Svg" focusable="false" aria-hidden="true"><path fill-rule="evenodd" d="M15.842 4.175a3.746 3.746 0 0 0-5.298 0l-2.116 2.117a3.75 3.75 0 0 0 .01 5.313l.338.336a.75.75 0 1 0 1.057-1.064l-.339-.337a2.25 2.25 0 0 1-.005-3.187l2.116-2.117a2.246 2.246 0 1 1 3.173 3.18l-1.052 1.047a.75.75 0 0 0 1.058 1.064l1.052-1.047a3.746 3.746 0 0 0 .006-5.305Zm-11.664 11.67a3.75 3.75 0 0 0 5.304 0l2.121-2.121a3.75 3.75 0 0 0 0-5.303l-.362-.362a.75.75 0 0 0-1.06 1.06l.362.362a2.25 2.25 0 0 1 0 3.182l-2.122 2.122a2.25 2.25 0 1 1-3.182-3.182l1.07-1.07a.75.75 0 1 0-1.062-1.06l-1.069 1.069a3.75 3.75 0 0 0 0 5.303Z"></path></svg></span></span><span class="Polaris-Text--root Polaris-Text--bodySm">${escapeHtml(label)}</span></span></a>`
}

interface LinkPillOptions {
  storeFqdn: string
  appName?: string
  appUrl?: string
}

function linkPillsHtml({storeFqdn, appName, appUrl}: LinkPillOptions): string {
  const appPill =
    appName && appUrl ? `<span class="top-bar-section-title">App: </span>${linkPillHtml(appUrl, appName)}` : ''
  return `<div id="outbound-links" class="top-bar-section with-shrunk-icon"><span class="top-bar-section-title">Store: </span>${linkPillHtml(
    `https://${storeFqdn}/admin`,
    storeFqdn,
  )}${appPill}</div>`
}

const serverStoppedBannerHtml = `<div class="Polaris-Banner Polaris-Banner--withinPage" tabindex="0" role="alert" aria-live="polite"><div class="Polaris-Box" style="--pc-box-border-radius:var(--p-border-radius-300);--pc-box-padding-block-start-xs:var(--p-space-300);--pc-box-padding-block-end-xs:var(--p-space-300);--pc-box-padding-inline-start-xs:var(--p-space-300);--pc-box-padding-inline-end-xs:var(--p-space-300);--pc-box-width:100%"><div class="Polaris-InlineStack" style="--pc-inline-stack-align:space-between;--pc-inline-stack-block-align:center;--pc-inline-stack-wrap:nowrap;--pc-inline-stack-flex-direction-xs:row"><div class="Polaris-Box" style="--pc-box-width:100%"><div class="Polaris-InlineStack" style="--pc-inline-stack-block-align:center;--pc-inline-stack-wrap:nowrap;--pc-inline-stack-gap-xs:var(--p-space-200);--pc-inline-stack-flex-direction-xs:row"><div><div class="Polaris-Box" style="--pc-box-background:var(--p-color-bg-fill-critical);--pc-box-border-radius:var(--p-border-radius-200);--pc-box-padding-block-start-xs:var(--p-space-100);--pc-box-padding-block-end-xs:var(--p-space-100);--pc-box-padding-inline-start-xs:var(--p-space-100);--pc-box-padding-inline-end-xs:var(--p-space-100)"><span class="Polaris-Banner--textCriticalOnBgFill"><span class="Polaris-Icon"><svg viewBox="0 0 20 20" class="Polaris-Icon__Svg" focusable="false" aria-hidden="true"><path fill-rule="evenodd" d="M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-3.677 4.383a5.5 5.5 0 0 1-7.706-7.706l7.706 7.706Zm1.06-1.06-7.706-7.706a5.5 5.5 0 0 1 7.706 7.706Z"></path></svg></span></span></div></div><div class="Polaris-Box" style="--pc-box-width:100%"><div class="Polaris-BlockStack" style="--pc-block-stack-order:column;--pc-block-stack-gap-xs:var(--p-space-200)"><div><span class="Polaris-Text--root Polaris-Text--bodyMd"><p>The server has been stopped. Restart it from the CLI.</p></span></div></div></div></div></div><div class="Polaris-Banner__DismissIcon"><button class="Polaris-Button Polaris-Button--pressable Polaris-Button--variantTertiary Polaris-Button--sizeMedium Polaris-Button--textAlignCenter Polaris-Button--iconOnly" aria-label="" type="button"><span class="Polaris-Button__Icon"><span class="Polaris-Banner__icon--secondary"><span class="Polaris-Icon"><svg viewBox="0 0 20 20" class="Polaris-Icon__Svg" focusable="false" aria-hidden="true"><path d="M12.72 13.78a.75.75 0 1 0 1.06-1.06l-2.72-2.72 2.72-2.72a.75.75 0 0 0-1.06-1.06l-2.72 2.72-2.72-2.72a.75.75 0 0 0-1.06 1.06l2.72 2.72-2.72 2.72a.75.75 0 1 0 1.06 1.06l2.72-2.72 2.72 2.72Z"></path></svg></span></span></span></button></div></div></div></div>`

interface TopBarOptions extends LinkPillOptions {
  apiVersion: string
  apiVersions: string[]
  unauthorizedLabel: string
  scopesNote: string
}

function topBarHtml({
  apiVersion,
  apiVersions,
  storeFqdn,
  appName,
  appUrl,
  unauthorizedLabel,
  scopesNote,
}: TopBarOptions): string {
  return `${topBarOpenHtml}${statusBadgesHtml(unauthorizedLabel)}${versionSelectHtml(
    apiVersions,
    apiVersion,
  )}${linkPillsHtml({
    storeFqdn,
    appName,
    appUrl,
  })}</div></div><div class="Polaris-Grid-Cell Polaris-Grid-Cell--cell_3ColumnXs Polaris-Grid-Cell--cell_3ColumnSm Polaris-Grid-Cell--cell_3ColumnMd Polaris-Grid-Cell--cell_5ColumnLg Polaris-Grid-Cell--cell_5ColumnXl"><div id="scopes-note" class="top-bar-section"><span class="Polaris-Text--root Polaris-Text--subdued">${escapeHtml(
    scopesNote,
  )}</span></div></div></div><div id="top-error-bar">${serverStoppedBannerHtml}</div></div></div></div><div id="PolarisPortalsContainer"></div>`
}

/**
 * Returns the HTML for the GraphiQL page, ready to be rendered as a Liquid template.
 *
 * @param options - The dynamic values to interpolate into the page.
 * @returns The HTML for the GraphiQL page.
 */
export function graphiqlTemplate(options: GraphiQLTemplateOptions): string {
  const {apiVersion, apiVersions, appName, appUrl, key, storeFqdn, protectMutations = false} = options
  const hasAppContext = Boolean(appName && appUrl)
  const unauthorizedLabel = hasAppContext ? 'App uninstalled' : 'Auth invalid'
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>GraphiQL</title>
    <link rel="shortcut icon" href="{{url}}/graphiql/favicon.ico" type="image/x-icon" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@shopify/polaris@12.10.0/build/esm/styles.css" />
    <style>
      body {
        height: 100%;
        margin: 0;
        width: 100%;
        overflow: hidden;
      }
      .Polaris-Page--fullWidth {
        width: 100%;
      }
      #top-bar {
        border-bottom: 1px solid var(--p-color-border);
      }
      #top-bar #top-error-bar {
        display: none;
      }
      #top-error-bar .Polaris-FullscreenBar__BackAction {
        /* hide default back button in FullscreenBar component */
        display: none;
      }
      #top-error-bar button {
        /* hide X to dismiss banner */
        display: none;
      }
      #top-bar .top-bar-section {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      #top-bar .Polaris-Grid-Cell:nth-child(2) {
        justify-self: right;
      }
      #top-bar #scopes-note {
        display: inline-flex;
        align-items: center;
        height: 100%;
      }
      #top-bar .status-badge-option {
        gap: 8px;
        display: none;
      }
      #top-bar #status-badge-running {
        display: flex;
      }
      #graphiql {
        height: 100vh;
        display: flex;
        flex-direction: column;
      }
      #graphiql-explorer {
        flex-grow: 1;
        overflow: auto;
      }
      #top-bar #outbound-links a {
        line-height: 0;
      }
      #top-bar #outbound-links a:hover .Polaris-Text--root {
        text-decoration: underline;
      }
      #top-bar #outbound-links a span.Polaris-Text--root {
        max-width: max(12vw, 150px);
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }
      .with-shrunk-icon .Polaris-Icon {
        height: 1rem;
        width: 1rem;
        margin: 0.125rem;
      }
      @media only screen and (max-width: 1550px) {
        .top-bar-section-title {
          display: none;
        }
      }
      @media only screen and (max-width: 1150px) {
        #top-bar #outbound-links a span.Polaris-Text--root {
          max-width: max(12vw, 140px);
        }
      }
      @media only screen and (max-width: 1080px) {
        #top-bar .Polaris-Grid-Cell:nth-child(2) {
          justify-self: left;
        }
      }
      @media only screen and (max-width: 650px) {
        #top-bar #outbound-links a span.Polaris-Text--root {
          max-width: 17vw;
        }
      }
    </style>

    <script
      src="https://cdn.jsdelivr.net/npm/react@17/umd/react.development.js"
      integrity="sha512-Vf2xGDzpqUOEIKO+X2rgTLWPY+65++WPwCHkX2nFMu9IcstumPsf/uKKRd5prX3wOu8Q0GBylRpsDB26R6ExOg=="
      crossorigin="anonymous"
    ></script>
    <script
      src="https://cdn.jsdelivr.net/npm/react-dom@17/umd/react-dom.development.js"
      integrity="sha512-Wr9OKCTtq1anK0hq5bY3X/AvDI5EflDSAh0mE9gma+4hl+kXdTJPKZ3TwLMBcrgUeoY0s3dq9JjhCQc7vddtFg=="
      crossorigin="anonymous"
    ></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphiql@3.0.4/graphiql.min.css" />
  </head>
  <body>
    <div id="graphiql">
      ${topBarHtml({
        apiVersion,
        apiVersions,
        storeFqdn,
        appName,
        appUrl,
        unauthorizedLabel,
        scopesNote: scopesNoteText({hasAppContext, protectMutations}),
      })}
      <div id="graphiql-explorer">Loading...</div>
    </div>
    <script
      src="https://cdn.jsdelivr.net/npm/graphiql@3.0.4/graphiql.min.js"
      type="application/javascript"
    ></script>
    <script>
      const macCommandKey = String.fromCodePoint(8984)
      const renderGraphiQL = function(apiVersion) {
        ReactDOM.render(
          React.createElement(GraphiQL, {
            fetcher: GraphiQL.createFetcher({
              url: '{{url}}/graphiql/graphql.json?key=${encodeURIComponent(key)}&api_version=' + apiVersion,
            }),
            defaultEditorToolsVisibility: true,
            {% if query %}
            query: {{query}},
            {% endif %}
            {% if variables %}
            variables: {{variables}},
            {% endif %}
            defaultTabs: [
              {query: "${graphiqlIntroMessage
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')}".replace(/MAC_COMMAND_KEY/g, macCommandKey)},
              {%for query in defaultQueries%}
                {query: "{%if query.preface %}{{query.preface}}\\n{% endif %}{{query.query}}", variables: "{{query.variables}}"},
              {%endfor%}
            ],
            isHeadersEditorEnabled: true,
          }),
          document.getElementById('graphiql-explorer'),
        )
      }
      renderGraphiQL('${apiVersion}')

      // Update the version when the select changes
      document.getElementById('version-select').addEventListener('change', function(event) {
        document.querySelector('#version-select .Polaris-Select__SelectedOption').innerText = event.target.value
        renderGraphiQL(event.target.value)
      })

      // Start out optimistic
      let serverIsLive = true
      let appIsInstalled = true

      const updateBadge = function() {
        const topErrorBar = document.querySelector('#graphiql #top-error-bar')
        const statusDiv = document.querySelector('#graphiql #status-badge')
        const allBadgeDivs = Array.from(statusDiv.querySelectorAll('.status-badge-option'))
        let activeBadge = 'running'
        if (!appIsInstalled) activeBadge = 'unauthorized'
        if (!serverIsLive) activeBadge = 'disconnected'
        allBadgeDivs.forEach(function(badge) {
          if (badge.id == ('status-badge-' + activeBadge)) {
            badge.style.display = 'flex'
          } else {
            badge.style.display = 'none'
          }
        })
        topErrorBar.style.display = serverIsLive ? 'none' : 'block'
      }
      const statusInterval = setInterval(updateBadge, 1000)

      // Warn when the server has been stopped
      const displayErrorServerStoppedTimeouts = []
      const pingInterval = setInterval(function() {
        displayErrorServerStoppedTimeouts.push(setTimeout(function() { serverIsLive = false }, 3000))
        fetch('{{url}}/graphiql/ping')
          .then(function(response) {
            if (response.status === 200) {
              while (displayErrorServerStoppedTimeouts.length > 0) {
                const timeout = displayErrorServerStoppedTimeouts.pop()
                clearTimeout(timeout)
              }
              serverIsLive = true
            } else {
              serverIsLive = false
            }
          })
      }, 2000)

      // Verify the current store/app connection
      setInterval(function() {
        fetch('{{ url }}/graphiql/status?key=${encodeURIComponent(key)}')
          .then(async function(response) {
            const {status, storeFqdn, appName, appUrl} = await response.json()
            appIsInstalled = status === 'OK'
            if (storeFqdn) {
              ${
                hasAppContext
                  ? `document.getElementById('outbound-links').innerHTML = \`${
                      // eslint-disable-next-line no-template-curly-in-string
                      linkPillsHtml({storeFqdn: '${storeFqdn}', appName: '${appName}', appUrl: '${appUrl}'})
                    }<div id="PolarisPortalsContainer"></div>\``
                  : `document.getElementById('outbound-links').innerHTML = \`${
                      // eslint-disable-next-line no-template-curly-in-string
                      linkPillsHtml({storeFqdn: '${storeFqdn}'})
                    }<div id="PolarisPortalsContainer"></div>\``
              }
            }
          })
      }, 5000)
    </script>
  </body>
</html>
`
}

function scopesNoteText({
  hasAppContext,
  protectMutations,
}: {
  hasAppContext: boolean
  protectMutations: boolean
}): string {
  if (protectMutations) {
    return MUTATIONS_BLOCKED_MESSAGE
  }
  if (hasAppContext) {
    return "GraphiQL runs on the same access scopes you've defined in the TOML file for your app."
  }
  return 'GraphiQL runs with the access scopes granted to the stored app authentication for this store.'
}
