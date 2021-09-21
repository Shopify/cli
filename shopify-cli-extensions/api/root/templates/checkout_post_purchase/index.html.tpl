<html>
  <head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, height=device-height, viewport-fit=cover">
  <style>
      * {
      box-sizing: border-box;
      }
      body {
      min-height: 100vh;
      min-height: -webkit-fill-available;
      display: grid;
      margin: 0;
      align-content: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
          'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
          sans-serif;
      }
      html {
      height: -webkit-fill-available;
      background: black;
      color: white;
      }
      .content {
      max-width: 40rem;
      padding: 2rem;
      font-size: 1.5em;
      }
      code {
      color: mediumseagreen;
      word-break: keep-all;
      }
  </style>
  </head>
  <body>
  <div class="content">
      <p>This page is served by your local UI Extension development server. Instead of visiting this page directly, you will need to connect your local development environment to a real checkout environment.</p>
      <p>Create a checkout and append <code>?dev={{ .Development.Root.Url }}</code> to the URL to start developing your extension.</p>
  </div>
  </body>
</html>