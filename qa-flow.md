Release checklist template (to copy)
Create a theme
Run shopify theme init <your_theme_name>
Check if creates a theme in the <your_theme_name> directory
Check all AI files variations
Install the Theme Access app if you haven’t already
Then “Create password” and enter your information
Check your email to get the password
You can then use in commands like shopify theme list --password <password>

For all of these that want you to test with regular auth and Theme Access app, it’s probably easiest to test with regular auth first (if you’re already logged in). Afterwards, run `shopify auth logout` and test with a password from the Theme Access app
Upload a theme (with regular auth and Theme Access app)
Go to the <your_theme_name> directory (from the previous step)
Run  shopify theme push
Select [Create a new theme]
Wait for the upload
Open the code editor (the URL of the code editor is https://<your_store>.myshopify.com/admin/themes/<your_theme_id>)
Check if all theme files have been uploaded (ie: all theme folders should be uploaded. But all other files/folders at the root like README.md should NOT be uploaded)
Run  shopify theme push --ignore "snippets/*" -u -t <theme_name>
Check if all files have been uploaded, except snippets

Download a theme (with regular auth and Theme Access app)
Go to an empty directory
Run  shopify theme pull
Select a theme
Wait for the download
Open the local directory
Check if all files have been downloaded
Go to another empty directory
Run  shopify theme pull --ignore "snippets/*" -t <theme_name>
Check if all files have been downloaded, except snippets

Develop a theme (with regular auth and Theme Access app)
Go to the <your_theme_name> directory (from the previous step)
Run  shopify theme dev
Open the http://127.0.0.1:9292 preview on Google Chrome
Insert some text inside the first <div> in sections/hello-world.liquid
Check if the text appears in the browser
Check in the Chrome Console if the hot reload logs appear, to be sure the page wasn't fully refreshed
Update assets/critical.css file with a visible change, something like * { background: #050 !important }
Check in the Chrome Console if the hot reload logs appear, to be sure the page wasn't fully refreshed
Update the layout/theme.liquid file
Notice the entire page gets refreshed and that your change appears in the browser
Stop the development server with CTRL+C

Develop a theme with the theme editor in companion mode
Go to the <your_theme_name> directory (from the previous step)
Run  shopify theme dev --theme-editor-sync
Open the http://127.0.0.1:9292 preview on Google Chrome
Open the theme editor (the URL of the code editor is https://<your_store>.myshopify.com/admin/themes/<your_theme_id>/editor)
Update some element in the index page using the theme editor and save it
Check if the element appears in the  http://127.0.0.1:9292 page
Check if the templates/index.json file is updated in the CLI log
Stop the development server with CTRL+C

Show information about your theme env
Run shopify theme info
Check if the proper information appears
Check all environments working
Run shopify theme info with an environments.default in a shopify.theme.toml file
Check if the proper information appears
Run `shopify theme info -e <mystore> using a shopify.theme.toml file
Check if the proper information appears
Run `shopify theme info -e <mystore> -e <mysecondstore> using a shopify.theme.toml file
Check if the proper information appears

Publish a theme
Run shopify theme publish
Select a theme
Check if the selected theme has been published in your store

List your themes
Run shopify theme list
Check if all themes are listed
Run shopify theme list --name "<prefix>*"
Check if the themes with the given prefix are listed as expected
Run shopify theme list --name "*<suffix>"
Check if the themes with the given suffix are listed as expected

Delete a theme
Run shopify theme delete
Select a theme
Check if the selected theme has been removed from your store
Run shopify theme delete -d -f
Check if the development theme is deleted without the confirmation prompt

Rename a theme
Run shopify theme rename
Type the new name
Select a theme to rename
Check if the select theme has been renamed as expected

Duplicate a theme
Run shopify theme duplicate
Check if the select theme has been duplicated as expected

Package a theme
Go to the <your_theme_name> directory (from the previous step)
Run shopify theme package
Check if the zip file with the theme has been created

Open a theme
Run shopify theme open
Select a theme
Check if the preview has been opened in the browser
Run shopify theme open -t <theme_name> --editor
Check if the theme editor, for the given theme, has been opened in the browser

Share a theme
Go to the <your_theme_name> directory (from the previous step)
Run shopify theme share
Wait for the upload
Open the preview URL
Check if the theme being previewed/shared matches with your local theme

Use theme console
Run shopify theme console
Try this Liquid snippet 1 | plus :2 | json | append: " << result" | upcase
Check if it evaluates to "3 << RESULT"
Run shopify theme console --url /products/classic-leather-jacket (you may use the URL of some product in your store)
Try this Liquid snippet product.title
Check if it evaluates to "Classic Leather Jacket"

Lint a theme
Go to the <your_theme_name> directory (from the previous step)
Run shopify theme check
Check if you get the result of the linting
Create a linting error – for example, replace a <div> with <dov>
Run shopify theme check
Notice the linting error appears
Run shopify theme check --init
Ignore the linting error
Add an auto-correctable offense in a Liquid file – for example: {{ '#EA5AB9' | hex_to_rgba }}
Run shopify theme check -a
Check if auto-corrects that offense
Run shopify theme check
Notice your linting error no longer appears
