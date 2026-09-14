---
id: ACTIVE_UPLOADS_AND_PRIVILEGED_PREVIEWS
version: 1
severity: high
---

# Active Uploads And Privileged Previews

Find cases where merchant-, customer-, webhook-, or external-service-supplied
files become active content in a privileged origin. Trace uploads, imports,
previews, and generated assets from ingestion through storage and final render.

The risk is not the upload alone. The risk is an untrusted-upload-to-active-render
path: SVG, HTML, XML, PDF, blob/data URL, or another active format is accepted and
later rendered in a storefront, embedded admin, customer-account, theme-editor,
or operator/admin context where it can execute or leak protected data.

## What to look for

1. **Find upload and import entry points.** Search for file uploads, import jobs,
   webhook attachments, remote fetches, document parsers, blob/data URL handling,
   and generated preview endpoints.

2. **Trace file metadata and validation.** Check size limits, extension checks,
   declared MIME type, magic-byte/file-signature verification, filename handling,
   generated storage names, antivirus/sanitization, and any image/PDF re-encoding.

3. **Inspect storage and serving boundaries.** Determine whether the object is
   stored on a non-executable origin, served with explicit `Content-Type` and
   `Content-Disposition`, and prevented from inheriting privileged cookies or
   browser authority.

4. **Follow every final renderer.** Check storefront/theme renderers, embedded
   admin previews, customer-account views, email/PDF previews, admin/operator
   tools, iframe/srcdoc/blob/data URL renderers, and any browser code that inserts
   the uploaded content into the DOM.

5. **Check sandboxing and isolation.** Verify iframes, preview origins, CSP,
   download headers, SVG sanitization, PDF handling, and re-encoding before
   deciding the content is safe.

## What to report

Report a finding only for a complete untrusted-upload-to-active-render path where
the uploaded or imported object is actually rendered or served into a privileged
executable context. Show:
- who controls the uploaded/imported content;
- which validation or isolation boundary is missing;
- where the content becomes active or executable;
- which privileged origin or user is affected; and
- file/line evidence for both the ingest path and the renderer/serving path.

Example:

```json
{
  "file": "app/controllers/previews_controller.rb",
  "line": 28,
  "message": "Uploaded SVG is rendered inline in the admin preview without sanitization or origin isolation",
  "evidence": [
    { "file": "app/controllers/uploads_controller.rb", "line": 14, "quote": "params[:file]" },
    { "file": "app/controllers/previews_controller.rb", "line": 28, "quote": "render inline: blob.download" }
  ],
  "confidence": "high",
  "reasoning": "The merchant-controlled SVG is stored without re-encoding and later rendered inline in the embedded admin origin, so script-capable SVG content can execute with merchant authority."
}
```

Do not report:
- files that are forced to download and never rendered in an active origin;
- images/PDFs that are re-encoded or sanitized before serving;
- isolated preview origins with no privileged cookies, storage, or message bridge;
- missing deployment details where you cannot establish executable rendering or unsafe serving.
- permissive content types, inline disposition, or storage/header hygiene issues
  without a concrete privileged renderer or execution surface.
