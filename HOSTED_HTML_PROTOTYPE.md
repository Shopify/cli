# Hosted HTML Apps - CLI Prototype

This prototype implements support for Hosted HTML applications in the Shopify CLI, based on the technical requirements outlined in the project documentation.

## Overview

Hosted HTML apps allow developers to build Shopify apps using standard HTML, CSS, and JavaScript without requiring React or the UI Extensions framework. This provides an escape hatch for use cases that need full control over the HTML structure while maintaining security through iframe sandboxing.

## Key Features Implemented

### 1. Extension Specification
- **File**: `packages/app/src/cli/models/extensions/specifications/hosted_html.ts`
- New extension type `hosted_html` with configuration schema
- Support for static file serving (HTML, CSS, JS, images, fonts)
- File size validation (50MB limit)
- Security validation for external resources (HTTPS enforcement)
- Configurable entrypoint (defaults to `index.html`)

### 2. Build System Integration
- Uses `copy_files` build mode (already supported by CLI)
- Copies all static assets to build directory
- Supports common web file types:
  - HTML, CSS, JavaScript, JSON
  - Images: PNG, JPG, JPEG, SVG, GIF, WebP
  - Fonts: WOFF, WOFF2, TTF, EOT
  - Other: ICO

### 3. Sandboxed Iframe Rendering
- **File**: `packages/app/src/cli/services/dev/extension/server/middlewares.ts`
- Implements security model using iframe with `srcdoc` attribute
- Creates null origin for sandboxed content
- Sandbox attributes: `allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox`
- Hash-based routing support via postMessage API
- CSP headers for additional security

### 4. Dev Server Support
- **File**: `packages/app/src/cli/services/dev/extension/server.ts`
- New middleware route for hosted HTML extensions
- Automatic content wrapping with sandboxing
- Support for navigation and browser history
- Asset serving from build directory

## Configuration

### Extension Configuration (shopify.extension.toml)

```toml
name = "my-hosted-html-app"
type = "hosted_html"
handle = "my-hosted-html-app"

# Entry point HTML file (optional, defaults to index.html)
entrypoint = "index.html"

api_version = "2024-10"

# Optional: Specify app home extension targets
# [[targeting]]
# target = "admin.app.home"
```

### Directory Structure

```
my-app/
├── shopify.app.toml
└── extensions/
    └── my-hosted-html-app/
        ├── shopify.extension.toml
        ├── index.html          # Entry point
        ├── styles.css          # Stylesheets
        ├── app.js              # JavaScript
        └── assets/             # Images, fonts, etc.
            └── logo.png
```

## Security Model

Based on the technical discussions, this implementation follows these security principles:

1. **Iframe Sandboxing**: Content is served via iframe with `srcdoc` to create a null origin
2. **HTTPS Enforcement**: External scripts and iframes must use HTTPS
3. **CSP Headers**: Content-Security-Policy headers restrict frame ancestors
4. **Size Limits**: Maximum 50MB bundle size to prevent CDN scaling issues
5. **File Type Validation**: Only whitelisted file types are allowed

## Routing Support

The implementation includes hash-based routing support:

```javascript
// In your app.js
function navigateTo(path) {
  // Notify parent frame about navigation
  window.parent.postMessage({
    type: 'HOSTED_APP_NAVIGATION',
    path: path
  }, '*');
}

// Listen for navigation updates from parent
window.addEventListener('message', (event) => {
  if (event.data.type === 'NAVIGATION_UPDATE') {
    // Handle route change
    updateUI(event.data.path);
  }
});
```

## Test Application

A sample test application is included in `test-hosted-app/`:

```bash
cd test-hosted-app
# Install dependencies (if you have a package.json)
# pnpm install

# Run the dev server
shopify app dev
```

The test app demonstrates:
- Pure HTML/CSS/JS structure
- Client-side routing
- Sandboxed iframe execution
- Navigation between pages
- Mock API integration

## Technical Implementation Details

### Build Process
1. Extension files are copied to `dist/` directory using `copyFilesForExtension()`
2. Build respects ignore patterns: `node_modules/**`, `.git/**`, test files
3. Output path calculation handles `copy_files` mode with empty `outputFileName`

### Dev Server Flow
1. Request to `/extensions/:extensionId` is intercepted by `getHostedHtmlMiddleware`
2. Middleware checks if extension type is `hosted_html`
3. Reads entrypoint HTML from build directory
4. Wraps content in sandboxed iframe wrapper HTML
5. Serves with appropriate security headers

### Validation
- **Pre-deployment**: Validates file types, sizes, and security concerns
- **HTML Validation**: Checks for non-HTTPS external resources
- **Size Validation**: Ensures total bundle stays under 50MB limit
- **Entrypoint Validation**: Confirms entrypoint file exists

## Future Enhancements

Based on the technical documents, future work should include:

1. **Content-Addressable Hashing**: For efficient asset management and deduplication
2. **Image Optimization**: Integration with Imagery service for automatic compression
3. **Subdomain Isolation**: Unique subdomain per app for enhanced security
4. **AMF Module Integration**: Backend work to support deployment to Shopify infrastructure
5. **Direct API Access**: Enable session token support for Shopify API calls
6. **Asset Pipeline**: Separate pipeline for non-code assets with MD5 hashing

## Known Limitations

1. **No Backend Module**: This is a CLI-only prototype. Deployment requires AMF module support.
2. **Local Dev Only**: Currently only works with `shopify app dev`, not deployment.
3. **Basic Security**: Security validation is basic. Production needs more comprehensive checks.
4. **No Asset Optimization**: Assets are copied as-is without optimization or compression.
5. **Single HTML File**: Srcdoc approach works best with single-page apps or client-side routing.

## Testing

To test the prototype:

1. Create a new extension with type `hosted_html`
2. Add HTML, CSS, and JS files
3. Configure entrypoint in `shopify.extension.toml`
4. Run `shopify app dev`
5. Access the extension via the dev server

## References

- Technical Document: Static/Hosted Apps - Asset Management and Security
- Meeting Notes: Hosted Apps - 2025/11/05 13:12 EST
- Hosted Apps Questions Document

## Architecture Decisions

### Why iframe with srcdoc?
- Creates null origin for security isolation
- Prevents direct access to parent frame's location
- Allows controlled communication via postMessage
- Avoids CSP whack-a-mole issues

### Why copy_files mode?
- Reuses existing CLI infrastructure
- Simple and predictable build process
- No bundling/transpilation overhead
- Preserves developer's original file structure

### Why hash routing?
- Most resilient within sandboxed iframe context
- Works with null origin restriction
- Doesn't require server-side routing
- Compatible with postMessage navigation API

## Contributing

When working on this prototype:

1. Maintain security boundaries - all external resources must be HTTPS
2. Follow existing CLI patterns for extension specifications
3. Add tests for new validation logic
4. Update this documentation with significant changes
5. Consider CDN scaling impact of any new features

## Contact

For questions about this prototype, see:
- Project docs: [Google Drive links from original request]
- Tech lead: Melissa Luu (starting after garden rotation)
- Contributors: Phiroze Noble, Jason Miller, David Cameron
