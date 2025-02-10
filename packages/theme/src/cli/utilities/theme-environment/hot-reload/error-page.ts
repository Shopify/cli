interface Error {
  message: string
  code: string
}

const POLARIS_STYLESHEET_URL = 'https://unpkg.com/@shopify/polaris@13.9.2/build/esm/styles.css'

function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function getErrorPage(options: {title: string; header: string; errors: Error[]}) {
  const html = String.raw
  return html`<!DOCTYPE html>
    <html>
      <head>
        <title>${options.title}</title>
        <link rel="stylesheet" href="${POLARIS_STYLESHEET_URL}" />
      </head>
      <body>
        <div style="display: flex; justify-content: center; padding-top: 2rem;">
          <div style="width: 80%;">
            <div class="Polaris-Banner Polaris-Banner--withinPage" tabindex="0" role="alert" aria-live="polite">
              <div class="Polaris-Box" style="--pc-box-width:100%">
                <div
                  class="Polaris-BlockStack"
                  style="--pc-block-stack-align:space-between;--pc-block-stack-order:column"
                >
                  <div
                    class="Polaris-Box"
                    style="--pc-box-color: var(--p-color-text-critical-on-bg-fill); --pc-box-background: var(--p-color-bg-fill-critical); --pc-box-padding-block-start-xs: var(--p-space-300); --pc-box-padding-block-end-xs: var(--p-space-300); --pc-box-padding-inline-start-xs: var(--p-space-300); --pc-box-padding-inline-end-xs: var(--p-space-300); --pc-box-border-start-start-radius: var(--p-border-radius-300); --pc-box-border-start-end-radius: var(--p-border-radius-300);"
                  >
                    <div
                      class="Polaris-InlineStack"
                      style="--pc-inline-stack-align:space-between;--pc-inline-stack-block-align:center;--pc-inline-stack-wrap:nowrap;--pc-inline-stack-gap-xs:var(--p-space-200);--pc-inline-stack-flex-direction-xs:row"
                    >
                      <div
                        class="Polaris-InlineStack"
                        style="--pc-inline-stack-wrap:nowrap;--pc-inline-stack-gap-xs:var(--p-space-100);--pc-inline-stack-flex-direction-xs:row"
                      >
                        <span class="Polaris-Banner--textCriticalOnBgFill">
                          <span class="Polaris-Icon">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                              <path d="M10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75Z" />
                              <path d="M11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
                              <path
                                fill-rule="evenodd"
                                d="M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-1.5 0a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0Z"
                              />
                            </svg>
                          </span>
                        </span>
                        <h2 class="Polaris-Text--root Polaris-Text--headingSm Polaris-Text--break">
                          ${options.header}
                        </h2>
                      </div>
                    </div>
                  </div>
                  <div
                    class="Polaris-Box"
                    style="--pc-box-padding-block-start-xs:var(--p-space-300);--pc-box-padding-block-end-xs:var(--p-space-300);--pc-box-padding-block-end-md:var(--p-space-400);--pc-box-padding-inline-start-xs:var(--p-space-300);--pc-box-padding-inline-start-md:var(--p-space-400);--pc-box-padding-inline-end-xs:var(--p-space-300);--pc-box-padding-inline-end-md:var(--p-space-400)"
                  >
                    <div
                      class="Polaris-BlockStack"
                      style="--pc-block-stack-order:column;--pc-block-stack-gap-xs:var(--p-space-300)"
                    >
                      ${options.errors
                        .map(
                          (error) => `
                          <div>
                            <span class="Polaris-Text--root Polaris-Text--headingSm">${escapeHtml(error.message)}</span>
                            <ul class="Polaris-List">
                              <li class="Polaris-List__Item">${escapeHtml(error.code)}</li>
                            </ul>
                          </div>`,
                        )
                        .join('')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>`
}
