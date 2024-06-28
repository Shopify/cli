import {execaSync} from 'execa'

// get current branch
const currentBranch = execaSync("git", ["branch","--show-current"]).stdout.trim()
console.log("Preparing to deploy branch: ", currentBranch)
// validate a clean state

// change to experimental
execaSync("git", ["checkout", "experimental"])

// reset experimental
console.log("Updating experimental branch...")
execaSync("git", ["reset", "--hard", currentBranch])

// push force experimental
console.log("Pushing experimental branch...")
execaSync("git", ["push", "origin", "experimental", "-f"])

// navigate to shipit
console.log("Done! go to shipit and hit deploy! -> https://shipit.shopify.io/shopify/cli/experimental")
open("https://shipit.shopify.io/shopify/cli/experimental")
