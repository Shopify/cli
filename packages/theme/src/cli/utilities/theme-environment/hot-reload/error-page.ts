interface Error {
  message: string
  code: string
}

export function getErrorPage(options: {title: string; header: string; errors: Error[]}) {
  const html = String.raw

  return html`<html>
    <head>
      <title>${options.title ?? 'Unknown error'}</title>
    </head>
    <body
      id="full-error-page"
      style="display: flex; flex-direction: column; align-items: center; padding-top: 20px; font-family: Arial"
    >
      <h1>${options.header}</h1>

      ${options.errors
        .map(
          (error) =>
            `<p>${error.message}</p>
              <pre>${error.code}</pre>`,
        )
        .join('')}
    </body>
  </html>`
}
