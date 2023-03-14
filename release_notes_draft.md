<!--
If your feature is significant enough that CLI users will want to know about it,
write a short summary sentence here. This is a draft document and will be
finalized when a new minor version is released.

Notes should look like this:

# App

* *A cool thing.* Rather than doing the annoying thing you used to do, you can
now do a different and much cooler thing.
* *A faster thing.* The `command` command was sped up by 3x in most cases.

# Theme

* *Another cool thing.* You get the idea by now.
-->

# App

* *JS functions.* JavaScript functions are now available! You can learn more in
the docs: https://shopify.dev/docs/apps/functions/language-support/javascript
* *Theme app extension logs.* Logs for theme app extensions will no longer
appear in a separate area and conflict with other logs or the preview/quit bar.
Instead, they will be integrated with the other logs. Progress bars have been
replaced with static output to accommodate this placement.
* *Customer accounts UI extension preview.* The link from the dev console for
Customer Accounts UI Extensions will now redirect to the customer account page.

# Theme

* *Theme environments.* Configure environments with theme and store in a
`shopify.theme.toml` file in your project root. Use the `--environment` flag (or
`-e` for short) to switch between environments. For more details, read the docs
at https://shopify.dev/...
* *Fix: Clean up theme errors.* Analytics requests were causing many errors in
both the CLI and Chrome consoles. These requests have been stubbed out.
* *Fix: CORS error on theme dev.* Eliminate CORS error in the browser console
when using hot module reloading.
* *Fix: 422 error on theme dev.* Truncate the development theme name to ≤ 50
characters, preventing a 422 error.
* *Fix: `Ruby is required to continue`.* Eliminate error where the CLI can't find
the ruby executable.
* *Fix: gem install permissions issues.* Use a local directory for gem
installations, avoiding permissions issues users experienced when installing to
their system gem directory.

# UI (applicable across project types)

* *Resizable select prompts.* The height of select prompts adjusts to the height
of the terminal, so that prompts won't be cut off in shorter terminals.
* *Fix: Log output utf8 support.* Special characters were appearing strangely
in subprocess logs, now they are correctly rendered using utf8.
* *Fix: Duplicated taskbar.* Swallow return key presses so they don't cause the
rainbow taskbar to be duplicated.
* *Fix: Dev footer duplicates on resize.* The persistent footer for `app dev`
would self-duplicate on terminal window resize. It is now displayed correctly.
* *Fix: Narrow terminal support.* Previously certain UI elements would look quite
strange in very narrow terminals, such as in CI tools. Now we enforce a minimum
of 20 characters' width, which is much easier to read.
