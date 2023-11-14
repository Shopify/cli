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
        padding: 0 4px;
        border-bottom: 1px solid #d6d6d6;
        font-family: sans-serif;
        font-size: 0.85em;
        color: #666;
      }
      .top-bar a {
        text-decoration: none;
      }
      #top-error-bar {
        display: none;
        background-color: #ff0000;
        color: #ffffff;
      }
      .top-bar p {
        margin: 0;
      }
      .top-bar .container {
        margin: 0;
        display: flex;
        flex-direction: row;
        align-content: start;
        align-items: stretch;
      }
      .top-bar .container:not(.bounded) {
        width: 100%;
      }
      .top-bar .container.bounded {
        max-width: 1200px;
        flex-wrap: wrap;
      }
      .top-bar .box {
        padding: 8px;
        text-align: left;
        align-self: center;
      }
      .top-bar .box.align-right {
        text-align: right;
        flex-grow: 1;
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
        <div class="box">⚠️ The server has been stopped. Restart <code>dev</code> and launch the GraphiQL Explorer from the terminal again.</div>
      </div>
      <div class="top-bar">
        <div class="container">
          <div class="container bounded">
            <div class="box">
              Status: <span id="status">🟢 Running</span>
            </div>
            <div class="box">
              API version:
              <select id="version-select">
                {% for version in versions %}
                  <option value="{{ version }}" {% if version == apiVersion %}selected{% endif %}>{{ version }}</option>
                {% endfor %}
              </select>
            </div>
            <div class="box">
              Store: <a href="https://{{ storeFqdn }}/admin" target="_blank">{{ storeFqdn }}</a>
            </div>
            <div class="box">
              App: <a href="{{ appUrl }}" target="_blank">{{ appName }}</a>
            </div>
          </div>
          <div class="box align-right">
            The GraphiQL Explorer uses the access scopes declared in your app's configuration file.
          </div>
        </div>
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
        const displayErrorServerStoppedTimeout = setTimeout(displayErrorServerStopped, 3000)
        fetch('{{url}}/graphiql/ping')
          .then(function(response) {
            if (response.status === 200) {
              clearTimeout(displayErrorServerStoppedTimeout)
              topErrorBar.style.display = 'none'
              statusDiv.innerHTML = '🟢 Running'
            } else {
              displayErrorServerStopped()
            }
          })
      }, 2000)
    </script>
  </body>
</html>
`

export const unauthorizedTemplate = `
<!DOCTYPE html>
<html>
  <head>
    <title>GraphiQL Explorer - App Not Installed</title>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="{{ url }}/graphiql/simple.css" />
    <script type="text/javascript">
      let appInstalled = false
      let newTab = null

      setInterval(function() {
        fetch('{{ url }}/graphiql/status')
          .then(async function(response) {
            const body = await response.json()
            if (body.status === 'OK') {
              if (newTab) newTab.close()
              document.getElementById('container').innerHTML = "Loading..."
              window.location.href = window.location.href
            }
          })
      }, 3000)

      function openAppInstallTab() {
        newTab = window.open('{{ previewUrl }}', '_blank')
      }
    </script>
  </head>
  <body class="body-error">
    <div class="app-error">
      <div id="container" class="container">
        <h1>App Not Installed</h1>
        <p>
          The GraphiQL Explorer is only available for apps that have been installed on your dev store.
        </p>
        <p>
          <a href="#" onclick="openAppInstallTab(); return false;">Install the app</a> to continue.
        </p>
      </div>
    </div>
  </body>
</html>
`
