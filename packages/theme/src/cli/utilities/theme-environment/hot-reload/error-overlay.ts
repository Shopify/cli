const OVERLAY_STYLES = {
  container: `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `,
  dialog: `
      background: rgba(200, 200, 200, 0.9);
      backdrop-filter: blur(10px);
      border-radius: 10px;
      padding: 20px;
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 80%;
      max-height: 80%;
      box-shadow: 0px 0px 10px rgba(0,0,0,0.5);
      position: relative;
      overflow-y: auto;
    `,
  closeButton: `
      position: absolute;
      top: 10px;
      right: 10px;
      background: transparent;
      border: none;
      font-size: 16px;
      cursor: pointer;
    `,
  errorItem: `
      margin-bottom: 16px;
      text-align: left;
    `,
  errorMessage: `
      margin: 8px 0;
      white-space: normal;
      word-wrap: break-word;
    `,
}

export function getErrorOverlay(errors: Map<string, string[]>): string {
  const errorContent = Array.from(errors.entries())
    .map(
      ([fileKey, messages]) => `
        <div style="${OVERLAY_STYLES.errorItem}">
          <strong>${fileKey}</strong>
          ${messages.map((msg) => `<pre style="${OVERLAY_STYLES.errorMessage}">- ${msg}</pre>`).join('')}
        </div>
      `,
    )
    .join('')

  return `
      <div id="section-error-overlay" style="${OVERLAY_STYLES.container}">
        <div style="${OVERLAY_STYLES.dialog}">
          ${errorContent}
          <button
            style="${OVERLAY_STYLES.closeButton}"
            onclick="document.getElementById('section-error-overlay').style.display='none';"
          >
            &times;
          </button>
        </div>
      </div>
    `
}

export function injectErrorIntoHtml(html: string, errors: Map<string, string[]>): string {
  return html + getErrorOverlay(errors)
}
