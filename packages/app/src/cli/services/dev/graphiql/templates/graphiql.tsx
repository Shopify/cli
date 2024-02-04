import {platformAndArch} from '@shopify/cli-kit/node/os'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {AppProvider, Badge, Banner, BlockStack, Box, Grid, InlineStack, Link, Select, Text} from '@shopify/polaris'
import {AlertCircleIcon, DisabledIcon, LinkIcon} from '@shopify/polaris-icons'

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
  appName: string
  appUrl: string
  key?: string
  storeFqdn: string
}

export function graphiqlTemplate({
  apiVersion,
  apiVersions,
  appName,
  appUrl,
  key,
  storeFqdn,
}: GraphiQLTemplateOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>GraphiQL</title>
    <link rel="shortcut icon" href="{{url}}/graphiql/favicon.ico" type="image/x-icon" />
    <link rel="stylesheet" href="https://unpkg.com/@shopify/polaris@12.10.0/build/esm/styles.css" />
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
      src="https://unpkg.com/react@17/umd/react.development.js"
      integrity="sha512-Vf2xGDzpqUOEIKO+X2rgTLWPY+65++WPwCHkX2nFMu9IcstumPsf/uKKRd5prX3wOu8Q0GBylRpsDB26R6ExOg=="
      crossorigin="anonymous"
    ></script>
    <script
      src="https://unpkg.com/react-dom@17/umd/react-dom.development.js"
      integrity="sha512-Wr9OKCTtq1anK0hq5bY3X/AvDI5EflDSAh0mE9gma+4hl+kXdTJPKZ3TwLMBcrgUeoY0s3dq9JjhCQc7vddtFg=="
      crossorigin="anonymous"
    ></script>
    <link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" />
  </head>
  <body>
    <div id="graphiql">
      ${renderToStaticMarkup(
        <AppProvider i18n={{}}>
          <div id="top-bar">
            <Box background="bg-surface" padding="400">
              <BlockStack gap="300">
                <Grid columns={{xs: 3, sm: 3, md: 3}}>
                  <Grid.Cell columnSpan={{xs: 3, sm: 3, md: 3, lg: 7, xl: 7}}>
                    <InlineStack gap="400">
                      <div id="status-badge" className="top-bar-section">
                        <div className="status-badge-option" id="status-badge-running">
                          <span className="top-bar-section-title">Status: </span>
                          <Badge tone="success" progress="complete">
                            Running
                          </Badge>
                        </div>
                        <div className="status-badge-option with-shrunk-icon" id="status-badge-unauthorized">
                          <span className="top-bar-section-title">Status: </span>
                          <Badge tone="attention" icon={AlertCircleIcon}>
                            App uninstalled
                          </Badge>
                        </div>
                        <div className="status-badge-option with-shrunk-icon" id="status-badge-disconnected">
                          <span className="top-bar-section-title">Status: </span>
                          <Badge tone="critical" icon={DisabledIcon}>
                            Disconnected
                          </Badge>
                        </div>
                      </div>
                      <div id="version-select" className="top-bar-section">
                        <span className="top-bar-section-title">API version: </span>
                        <Select
                          label="API version"
                          labelHidden
                          options={apiVersions}
                          value={apiVersion}
                          onChange={() => {}}
                        />
                      </div>
                      {linkPills({storeFqdn, appName, appUrl})}
                    </InlineStack>
                  </Grid.Cell>
                  <Grid.Cell columnSpan={{xs: 3, sm: 3, md: 3, lg: 5, xl: 5}}>
                    <div id="scopes-note" className="top-bar-section">
                      <Text as="span" tone="subdued">
                        GraphiQL runs on the same access scopes you’ve defined in the TOML file for your app.
                      </Text>
                    </div>
                  </Grid.Cell>
                </Grid>
                <div id="top-error-bar">
                  <Banner tone="critical" onDismiss={() => {}} icon={DisabledIcon}>
                    <p>
                      The server has been stopped. Restart <code>dev</code> from the CLI.
                    </p>
                  </Banner>
                </div>
              </BlockStack>
            </Box>
          </div>
        </AppProvider>,
      )}
      <div id="graphiql-explorer">Loading...</div>
    </div>
    <script
      src="https://unpkg.com/graphiql@3.0.4/graphiql.min.js"
      type="application/javascript"
    ></script>
    <script>
      const macCommandKey = String.fromCodePoint(8984)
      const renderGraphiQL = function(apiVersion) {
        ReactDOM.render(
          React.createElement(GraphiQL, {
            fetcher: GraphiQL.createFetcher({
              url: '{{url}}/graphiql/graphql.json?key=${key ?? ''}&api_version=' + apiVersion,
            }),
            defaultEditorToolsVisibility: true,
            {% if query %}
            query: '{{query}}',
            {% endif %}
            defaultTabs: [
              {query: "${graphiqlIntroMessage
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')}".replace(/MAC_COMMAND_KEY/g, macCommandKey)},
              {%for query in defaultQueries%}
                {query: "{%if query.preface %}{{query.preface}}\\n{% endif %}{{query.query}}", variables: "{{query.variables}}"},
              {%endfor%}
            ],
            isHeadersEditorEnabled: false,
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
        fetch('{{ url }}/graphiql/status')
          .then(async function(response) {
            const {status, storeFqdn, appName, appUrl} = await response.json()
            appIsInstalled = status === 'OK'
            if (storeFqdn) {
              document.getElementById('outbound-links').innerHTML = \`${renderToStaticMarkup(
                // Create HTML string with substitutions included
                <AppProvider i18n={{}}>
                  {
                    // eslint-disable-next-line no-template-curly-in-string
                    linkPills({storeFqdn: '${storeFqdn}', appName: '${appName}', appUrl: '${appUrl}'})
                  }
                </AppProvider>,
              )}\`
            }
          })
      }, 5000)
    </script>
  </body>
</html>
`
}

interface LinkPillOptions {
  storeFqdn: string
  appName: string
  appUrl: string
}

function linkPills({storeFqdn, appName, appUrl}: LinkPillOptions) {
  return (
    <div id="outbound-links" className="top-bar-section with-shrunk-icon">
      <span className="top-bar-section-title">Store: </span>
      <Link url={`https://${storeFqdn}/admin`} target="_blank">
        <Badge tone="info" icon={LinkIcon} children={storeFqdn} />
      </Link>
      <span className="top-bar-section-title">App: </span>
      <Link url={appUrl} target="_blank">
        <Badge tone="info" icon={LinkIcon} children={appName} />
      </Link>
    </div>
  )
}
