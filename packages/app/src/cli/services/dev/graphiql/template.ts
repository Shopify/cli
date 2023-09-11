import {platformAndArch} from '@shopify/cli-kit/node/os'

const controlKey = platformAndArch().platform === 'darwin' ? 'MAC_COMMAND_KEY' : 'Ctrl'

const graphiqlIntroMessage = `
# Welcome to the Shopify GraphiQL Explorer! If you've used GraphiQL before,
# you can go ahead and jump to the next tab.
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

export const template = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>GraphiQL</title>
    <style>
      body {
        height: 100%;
        margin: 0;
        width: 100%;
        overflow: hidden;
      }
      .top-bar {
        padding: 4px;
        border-bottom: 1px solid #d6d6d6;
      }
      #top-error-bar {
        display: none;
        background-color: #ff0000;
        color: #ffffff;
      }
      .top-bar p {
        margin: 0;
      }
      .top-bar table {
        margin: 0;
        width: 100%;
        max-width: 1200px;
      }
      .top-bar table thead td {
        padding: 0 8px;
        text-align: left;
        font-weight: bold;
      }
      .top-bar table tbody td {
        padding: 0 8px;
        text-align: left;
        color: #666;
      }
      .top-bar table tbody td .note {
        font-size: 0.8em;
        color: #999;
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
      <div id="top-error-bar" class="top-bar">
        <p>⚠️ The server has been stopped. Restart <code>dev</code> and launch the GraphiQL Explorer from the terminal again.</p>
      </div>
      <div class="top-bar">
        <table>
          <thead>
            <td>
              ⚡️ Status
            </td>
            <td>
              👩‍💻 API version
            </td>
            <td>
              🏪 Store
            </td>
            <td>
              ⚙️  App
            </td>
            <td>
              🔑 Scopes
            </td>
          </thead>
          <tbody>
            <td>
              <p id="status">🟢 Running</p>
            </td>
            <td>
              <p id="api-version">
                <select id="version-select">
                  {% for version in versions %}
                    <option value="{{ version }}" {% if version == apiVersion %}selected{% endif %}>{{ version }}</option>
                  {% endfor %}
                </select>
              </p>
            </td>
            <td>
              <p id="store">{{ storeFqdn }}</p>
            </td>
            <td>
              <p id="app">{{ appName }}</p>
            </td>
            <td>
              <p id="scopes"><code>{{ scopes }}</code></p>
              <p class="note">add/change scopes in the <code>shopify.app.toml</code> file</p>
            </td>
          </tbody>
        </table>
      </div>
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
              url: '{{url}}/graphiql/graphql.json?api_version=' + apiVersion,
            }),
            defaultEditorToolsVisibility: true,
            defaultTabs: [
              {query: "${graphiqlIntroMessage
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')}".replace(/MAC_COMMAND_KEY/g, macCommandKey)},
              {%for query in defaultQueries%}
                {query: "{%if query.preface %}{{query.preface}}\\n{% endif %}{{query.query}}", variables: "{{query.variables}}"},
              {%endfor%}
            ],
          }),
          document.getElementById('graphiql-explorer'),
        )
      }
      renderGraphiQL('{{apiVersion}}')

      // Update the version when the select changes
      document.getElementById('version-select').addEventListener('change', function(event) {
        renderGraphiQL(event.target.value)
      })

      // Warn when the server has been stopped
      const pingInterval = setInterval(function() {
        const topErrorBar = document.querySelector('#graphiql #top-error-bar')
        const statusDiv = document.querySelector('#graphiql #status')
        const displayErrorServerStopped = function() {
          topErrorBar.style.display = 'block'
          statusDiv.innerHTML = '❌ Disconnected'
        }
        const displayErrorServerStoppedTimeout = setTimeout(displayErrorServerStopped, 1000)
        fetch('{{url}}/graphiql/ping')
          .then(function(response) {
            if (response.status === 200) {
              topErrorBar.style.display = 'none'
              statusDiv.innerHTML = '🟢 Running'
              clearTimeout(displayErrorServerStoppedTimeout)
            } else {
              displayErrorServerStopped()
            }
          })
      }, 2000)
    </script>
  </body>
</html>
`
