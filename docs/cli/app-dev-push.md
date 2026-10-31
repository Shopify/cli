# Push a dev preview without local servers

`shopify app dev push` builds and uploads the app configuration and extensions once, creates a dev preview on a development store, and exits. It does not deploy your web backend, start local servers, create a tunnel, watch files, or release a production app version.

```sh
shopify app dev push --config preview --store my-test-store.myshopify.com \
  --url https://my-backend-preview.example.com --json --no-input
```

## Hosted backend and URL configuration

Deploy your backend separately before pushing. `--url` accepts an HTTPS origin, optionally with a port, but no path, credentials, query, or fragment. It uses the existing `app dev` rewriting for the application URL, OAuth callback paths, and app proxy. The override is applied to the uploaded snapshot, not written back to TOML. Without the flag, configured URLs are retained.

Configure the backend to use that same origin for its own authentication/callback behavior. Use a deployment-specific URL and keep that deployment available for as long as the preview is needed. The CLI cannot freeze a mutable backend alias, database, or external service.

Only extensions are built by this command; web `build` and `dev` scripts are not run. Theme host setup, checkout-cart discovery, and local dev-console preview servers are not started. Configure theme blocks or other test surfaces separately where needed.

## Preview ownership and existing live previews

A dev preview is a shared slot for an app and store, not an immutable version history or a separate environment for each branch. Another push or `app dev` run can replace it. Use different dev stores or serialize runs when testing concurrently.

Before switching a live preview to a static snapshot, stop its `app dev` process and explicitly clean that preview:

```sh
shopify app dev clean --config preview --store my-test-store.myshopify.com --no-input
shopify app dev push --config preview --store my-test-store.myshopify.com \
  --url https://my-backend-preview.example.com --no-input
```

The CLI refuses to push while a local `app dev` session for the same configuration is running. It can't detect `app dev` running elsewhere: the API keeps a stored websocket URL when creation omits it, so a push over a live preview that wasn't cleaned may still reference that session until you run `shopify app dev clean`. The command never deletes an existing preview. A separate process or machine can still race a push; there is no atomic cross-client ownership guarantee.

`shopify app dev clean` restores the released app version. It does not delete the app or your externally hosted backend.

## Authentication and installation

Use your normal account or `SHOPIFY_SERVICE_ACCOUNT_TOKEN`. Service-account workflows need app management, dev-store access, permission for the selected app, and sufficient authorization on the selected store. This command skips provisioning a user login and never requests a user-authenticated Admin API session.

The preview API handles installation and required-scope grants for managed-install apps, subject to its permission checks. Legacy-install apps still need their authorization flow. Creating a preview does not hand your backend an Admin API access token; it must use its normal supported authentication flow. Dev store management access alone is not authorization to seed app data.

## Results

`--json` writes one result object with `status`, `app` (`name`, `clientId`), `storeDomain`, `appUrl`, `previewUrl`, and `warnings`. Progress and diagnostics go to stderr. `previewUrl` opens the app in the store's admin without assuming a local dev console is running.

Build, validation, upload, or creation failures exit nonzero. Temporary bundle files are removed after the operation finishes or fails. Successful completion means the server accepted the snapshot, not that the external backend or every browser surface has passed an end-to-end health check.

During the push operation, Ctrl-C or termination stops dependency installation, owned builds, and requests before cleaning temporary bundles. Cancellation emits a fatal JSON error with code `dev_push_cancelled` and a nonzero exit status (130 for Ctrl-C, 143 for SIGTERM). If cancellation happens after creation was sent, the server may already have applied the preview; inspect the store before retrying. Cancellation does not roll back or delete a remote preview.
