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

// long story short, there are only two ways to use an SVG as a CSS value: pass a url to the svg asset (which we could do by uploading the file to our CDN), or by encoding the SVG directly into the CSS value. I've opted to do here. For posterity, the encoded SVG url was generated using https://yoksel.github.io/url-encoder/
export const linkIconSvgAsEncodedCssUrl = `
url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M9.36396 2.08579C8.58291 1.30474 7.31658 1.30474 6.53553 2.08579L4.41421 4.20711C3.63316 4.98816 3.63316 6.25449 4.41421 7.03553L4.76777 7.38909C4.96303 7.58435 5.27961 7.58435 5.47487 7.38909C5.67014 7.19382 5.67014 6.87724 5.47487 6.68198L5.12132 6.32843C4.7308 5.9379 4.7308 5.30474 5.12132 4.91421L7.24264 2.79289C7.63316 2.40237 8.26633 2.40237 8.65685 2.79289L9.36396 3.5C9.75449 3.89052 9.75449 4.52369 9.36396 4.91421L9.01041 5.26777C8.81515 5.46303 8.81515 5.77961 9.01041 5.97487C9.20567 6.17014 9.52225 6.17014 9.71751 5.97487L10.0711 5.62132C10.8521 4.84027 10.8521 3.57394 10.0711 2.79289L9.36396 2.08579ZM2.29289 10.5711C3.07394 11.3521 4.34027 11.3521 5.12132 10.5711L7.24264 8.44975C8.02369 7.6687 8.02369 6.40237 7.24264 5.62132L6.88909 5.26777C6.69383 5.0725 6.37724 5.0725 6.18198 5.26777C5.98672 5.46303 5.98672 5.77961 6.18198 5.97487L6.53553 6.32843C6.92606 6.71895 6.92606 7.35212 6.53553 7.74264L4.41421 9.86396C4.02369 10.2545 3.39052 10.2545 3 9.86396L2.29289 9.15685C1.90237 8.76633 1.90237 8.13316 2.29289 7.74264L3 7.03553C3.19526 6.84027 3.19526 6.52369 3 6.32843C2.80474 6.13316 2.48816 6.13316 2.29289 6.32843L1.58579 7.03553C0.804738 7.81658 0.804738 9.08291 1.58579 9.86396L2.29289 10.5711Z' fill='%230094D5'/%3E%3C/svg%3E")
`

export const disconnectedIconSvgAsEncodedCssUrl = `
url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cg clip-path='url(%23clip0_70_289)'%3E%3Cpath d='M1.94194 1.05806C1.69786 0.813981 1.30214 0.813981 1.05806 1.05806C0.813981 1.30214 0.813981 1.69786 1.05806 1.94194L10.0581 10.9419C10.3021 11.186 10.6979 11.186 10.9419 10.9419C11.186 10.6979 11.186 10.3021 10.9419 10.0581L1.94194 1.05806Z' fill='%23B28400'/%3E%3Cpath d='M2 6C2 5.07003 2 4.60504 2.10222 4.22354L3.25243 5.37375C3.25067 5.5428 3.25 5.74808 3.25 6C3.25 7.01045 3.26074 7.27046 3.30963 7.45293C3.47145 8.05684 3.94316 8.52855 4.54707 8.69037C4.72954 8.73926 4.98955 8.75 6 8.75C6.25192 8.75 6.4572 8.74933 6.62625 8.74757L7.77646 9.89778C7.39496 10 6.92997 10 6 10C5.07003 10 4.60504 10 4.22354 9.89778C3.18827 9.62038 2.37962 8.81173 2.10222 7.77646C2 7.39496 2 6.92997 2 6Z' fill='%23B28400'/%3E%3Cpath d='M8.75 6C8.75 6.25192 8.74933 6.4572 8.74757 6.62625L9.89778 7.77646C10 7.39496 10 6.92997 10 6C10 5.07003 10 4.60504 9.89778 4.22354C9.62038 3.18827 8.81173 2.37962 7.77646 2.10222C7.39496 2 6.92997 2 6 2C5.07003 2 4.60504 2 4.22354 2.10222L5.37375 3.25243C5.5428 3.25067 5.74808 3.25 6 3.25C7.01045 3.25 7.27046 3.26074 7.45293 3.30963C8.05684 3.47145 8.52855 3.94316 8.69037 4.54707C8.73926 4.72954 8.75 4.98955 8.75 6Z' fill='%23B28400'/%3E%3C/g%3E%3Cdefs%3E%3CclipPath id='clip0_70_289'%3E%3Crect width='12' height='12' fill='white'/%3E%3C/clipPath%3E%3C/defs%3E%3C/svg%3E");
`

export const runningIconSvgAsEncodedCssUrl = `
url("data:image/svg+xml,%3Csvg width='8' height='8' viewBox='0 0 8 9' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect y='0.5' width='8' height='8' rx='3' fill='%2329845A'/%3E%3C/svg%3E");
`

export const graphiqlTopBarStyles = `
  .top-bar {
    padding: 0 4px;
    border-bottom: 1px solid #d6d6d6;
    margin: 0;
    display: grid;
    grid-template-columns: minmax(auto, max-content) minmax(auto, max-content) minmax(max-content, 1fr) minmax(auto, max-content);
    grid-template-rows: 1fr;
    align-items: center;
  }

  .top-bar-section {
    border-right: 1px solid var(--border-border-subdued, #EBEBEB);
    padding: 0.2rem 0.5rem;
    align-self: stretch;
    display: flex;
    flex-grow: 1;
    justify-content: left;
    align-items: center;
    gap: 0.75rem;
  }

  .top-bar-section.expand {
    flex-grow: 2;
  }

  .top-bar a {
    text-decoration: none;
  }

  .app-links {
    display: flex;
    gap: 4px;
  }

  .status-pill {
    padding: 2px 6px;
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .status-pill.connected {
    background: rgba(0, 0, 0, 0.03);
  }

  .status-pill.disconnected {
    background: var(--caution-surface-l-3, #FFD6A4);
  }

  .status-pill-icon {
    height: 8px;
    width: 8px;
  }

  .status-pill.connected .status-pill-icon {
    content: ${runningIconSvgAsEncodedCssUrl};
  }

  .status-pill.disconnected .status-pill-icon {
    content: ${disconnectedIconSvgAsEncodedCssUrl};
  }

  #version-select {
    border-radius: 0.5rem;
    border: 0.66px solid var(--input-subdued-border, #B5B5B5);
    background: var(--input-surface, #FDFDFD);
    padding: 0.5rem 0.75rem 0.5rem 0.5rem;
  }

  .link-label-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .link-pill {
    border-radius: 8px;
    background: var(--global-azure-04, #E0F0FF);
    padding: 2px 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .link-pill-pill {
    content: ${linkIconSvgAsEncodedCssUrl};
    height: 12px;
    width: 12px;
  }

  .link-pill .link-pill-contents {
    display: inline-block;
    max-width: max(12vw, 250px);
    text-overflow: ellipsis;
    overflow: hidden;
    text-wrap: nowrap;
    vertical-align: sub;
  }

  .link-pill a {
    color: var(--global-azure-10, #006AFF);
  }

  .align-right {
    text-align: right;
  }

  @media only screen and (max-width: 1600px) {
    .top-bar {
      font-size: 0.9em
    }
  }

  @media only screen and (max-width: 1250px) {
    .top-bar {
      font-size: 0.8em;
    }
  }

  @media only screen and (max-width: 1120px) {
    .top-bar-section-label {
      display: none;
    }

    .link-pill .link-pill-contents {
      max-width: max(8vw, 200px);
    }
  }

  @media only screen and (max-width: 940px) {
    .top-bar {
      grid-template-columns: minmax(max-content, auto) minmax(auto, max-content) minmax(max-content, 1fr);
    }

    .top-bar-section {
      border-right: none;
    }

    .top-bar-section.expand {
      grid-column: 1 / span 3;
    }
  }

  @media only screen and (max-width: 650px) {
    .link-pill .link-pill-contents {
      max-width: max(7vw, 90px);
    }
  }
`

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
        font-family: Inter, -apple-system, "system-ui", "San Francisco", "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
        font-size: 0.85em;
        color: #666;
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

      ${graphiqlTopBarStyles}
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
    <link rel="stylesheet" href="https://cdn.shopify.com/static/fonts/inter/inter.css" crossorigin="">
  </head>
  <body>
    <div id="graphiql">
      <div class="top-bar">
        <div class="top-bar-section">
          <p>
            <span class="top-bar-section-label">Status: </span>
            <span class="status-pill connected"><span class="status-pill-icon"></span><span id="status">Running</span></span>
          </p>
        </div>

        <div class="top-bar-section">
          <span class="top-bar-section-label">API version: </span>
          <select id="version-select">
            {% for version in versions %}
              <option value="{{ version }}" {% if version == apiVersion %}selected{% endif %}>{{ version }}</option>
            {% endfor %}
          </select>
        </div>

        <div class="top-bar-section">
          <div class="link-label-group">
            <span class="top-bar-section-label">Store: </span>
            <span class="link-pill"><span class="link-pill-pill"></span><span class="link-pill-contents">
              <a href="https://{{ storeFqdn }}/admin" target="_blank">{{ storeFqdn }}</a>
            </span></span>
          </div>

          <div class="link-label-group">
            <span class="top-bar-section-label">App: </span>
            <span class="link-pill"><span class="link-pill-pill"></span><span class="link-pill-contents">
              <a href="{{ appUrl }}" target="_blank">{{ appName }}</a></span>
            </span></span>
          </div>
        </div>

        <div class="top-bar-section expand align-right">
          GraphiQL runs on the same access scopes you’ve defined in the TOML file for your app.
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
        const statusSpan = document.querySelector('#graphiql .status-pill')
        const statusIconSpan = statusSpan.querySelector('.status-pill-icon')
        const statusTextSpan = statusSpan.querySelector('#status')
        const displayErrorServerStopped = function() {
          statusTextSpan.innerText = 'Disconnected'
          statusSpan.classList.remove('connected')
          statusSpan.classList.add('disconnected')
        }
        const displayErrorServerStoppedTimeout = setTimeout(displayErrorServerStopped, 3000)
        fetch('{{url}}/graphiql/ping')
          .then(function(response) {
            if (response.status === 200) {
              clearTimeout(displayErrorServerStoppedTimeout)
              statusTextSpan.innerText = 'Running'
              statusSpan.classList.remove('disconnected')
              statusSpan.classList.add('connected')
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
