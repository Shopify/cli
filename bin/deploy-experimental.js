import {execaSync} from 'execa'


async function deploy() {
  const changes = execaSync("git", ["status", "--porcelain"]).stdout.trim()

  // validate that we have a clean state
  if (changes.length > 0) {
    console.log("❌ You have uncommitted changes. Please commit or stash them before deploying.")
    process.exit(1)
  }

  // get current branch
  const currentBranch = execaSync("git", ["branch","--show-current"]).stdout.trim()
  console.log(`🏗️  Preparing to deploy "${currentBranch}" to experimental`)

  // change to experimental
  execaSync("git", ["checkout", "experimental"])

  // reset experimental
  console.log("🔄 Updating experimental branch...")
  execaSync("git", ["reset", "--hard", currentBranch])

  // push force experimental
  console.log("🙌 Pushing experimental branch...")
  execaSync("git", ["push", "origin", "experimental", "-f"])

  execaSync("git", ["checkout", currentBranch])

  // Wait a bit while shipit receives all the info
  await (new Promise(resolve => setTimeout(resolve, 2000)));

  // navigate to shipit
  const commit = execaSync("git", ["rev-parse", "HEAD"]).stdout.trim()
  const url = `https://shipit.shopify.io/shopify/cli/experimental/deploys/new/${commit}`
  console.log(`✅ Done! go to shipit and hit deploy! ->\n   ${url}`)
  execaSync("open", [url])
}

await deploy()
