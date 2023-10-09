# Release process

## Process

### Adding change sets when opening PRs

When changing any of the packages of the repository,
you'll have to run `pnpm changeset add`,
and [changesets](https://github.com/changesets/changesets) will guide you through the process of adding your changes to be included in the next version's changelog.
Note that if you skip this step when you open a PR,
CI will give a warning.

### Creating a new patch version
The steps are:
1. Locate the [opened PR](https://github.com/Shopify/cli/pulls?q=is%3Apr+is%3Aopen+in%3Atitle+%22Version+Packages%22) named **Version Packages - 3.x**. This PR is automatically created with the first merge in a stable branch after a previous release is published. _Changesets_ will automatically detect changes with each merge and update automatically the PR and consequently the `package.json`s and the dependencies between them
2. Verify that the correct version is updated in every `package.json`, <ins>paying special attention that there is no **major** or **minor** bump</ins>. Approve and merge the **Version Packages** PR when all checks have passed
3. Wait until the commit for **Version Packages** becomes <font color="green">green</font> in [the Shipit stack for your branch](https://shipit.shopify.io/shopify/cli) and push the _Deploy_ button.
4. Push again on the _Create deploy_ button to start the deployment. This will publish the CLI packages to the [NPM registry](https://www.npmjs.com/package/@shopify/cli). If there are failures (as it can be flaky), rerun the deployment and the missing packages should be published.
5. Create a new tag with the new version: `git tag 3.x.x && git push --tags`
6. [Create a new release in the CLI repo](https://github.com/Shopify/cli/releases/new):
    * Use the created tag ("3.x.x")
    * Release title: "3.x.x"
    * Description: summary of the most important changes from Version Packages PR
    * Click "Publish release"
7. Only if releasing a patch to the latest stable version: Once the deployment completes, [find the PR](https://github.com/Shopify/homebrew-shopify/pulls?q=is%3Apr+is%3Aopen+Shopify+CLI) in the homebrew-shopify repository and merge the changes in the formula.


### Creating a new minor version

1. Locate the [opened PR](https://github.com/Shopify/cli/pulls?q=is%3Apr+is%3Aopen+in%3Atitle+%22Version+Packages+-+main%22) named **Version Packages - main**. This PR is automatically created with the first merge in `main` after a previous release is published. _Changesets_ will automatically detect changes with each merge to main and update automatically the PR and consequently the `package.json`s and the dependencies between them
2. Verify that the correct version is updated in every _package.json_, <ins>paying special attention that there is no **major** bump</ins>. Approve and merge the **Version Packages - main** PR when all checks have passed.

Now create a PR with the release notes:

1. Create a new `RELEASE_NOTES/3.x.md` file, replacing `3.x` with the actual minor version number. Look at the changesets in the Version Packages PR and distill a list of changes that are relevant to our partners. Take a look at previous release files to see the recommended format. Commit.
2. Open a PR to `main`, get approval.
3. Merge!
4. Announce in `#shopify-cli` and `#cli-foundations-team` that the release has been cut, and merges are permitted.

You've designated a commit as releasable. Now time to publish via Shipit:

1. Wait until the commit for **Version Packages - main** becomes <font color="green">green</font> in [CLI Production Shipit](https://shipit.shopify.io/shopify/cli/production) and push the _Deploy_ button.
2. Push again on the _Create deploy_ button to start the deployment. This will publish the CLI packages to the [NPM registry](https://www.npmjs.com/package/@shopify/cli). If there are failures (as it can be flaky), rerun the deployment and the missing packages should be published.
3. Once the deployment completes, [find the auto-generated PR](https://github.com/Shopify/homebrew-shopify/pulls?q=is%3Apr+is%3Aopen+Shopify+CLI) in the homebrew-shopify repository and merge the changes in the formula.
4. Create a new tag with the new version: `git tag 3.x.x && git push --tags`
5. [Create a new release in the CLI repo](https://github.com/Shopify/cli/releases/new):
    * Use the created tag ("3.x.x")
    * Release title: "3.x.x"
    * Description: summary of the most important changes from Version Packages PR
    * Click "Publish release"
6. Go through all the [PRs labeled with `includes-post-release-steps`](https://github.com/Shopify/cli/issues?q=label%3Aincludes-post-release-steps+is%3Aclosed) and:
  1. Follow the post-release steps described in those PRs.
  2. Delete the labels afterward.

Finally, it's time to do a bit of manual shuffling, as we welcome a stable version and deprecate another:

1. Pull the latest `main` and check out the release commit.
2. From there, check out a branch called `stable/3.x` (replacing x with the minor version).
3. In the repo root, run `cp shipit.stable.yml.sample shipit.stable_3_x.yml; git add shipit.stable_3_x.yml; git commit -m "Add stable/3.x shipit configuration"` (replacing x with the minor version each time)
4. Push your branch.
5. [Create a shipit stack](https://shipit.shopify.io/stacks/new), setting branch to `stable/3.x` and environment to `stable_3_x` (replacing x with the minor version each time). The names are VERY IMPORTANT to get right, as they will enable Shipit to find your branch and detect deployable commits!
6. Checkout the previous minor release's `stable/3.x` branch.
7. Open that branch's `shipit.stable_3_x.yml` file and follow the directions in the `deploy.override` comments. This will do 2 things:
    1. Ensure Homebrew always points to the latest stable version
    2. Ensure npm's `@latest` tag always points to the latest stable version
8. Commit and push your changes.
9. If we have decided to label a minor version as end-of-life, find the appropriate stack in [CLI Shipit](https://shipit.shopify.io/shopify/cli) and archive it.

### Creating a new experimental version
Sometimes it's not easy to test some modification you have made, for example, if you modify some dependencies that genarete an issue when they are installed with an specific `package-manager`. In those cases, you can `create a new app` using the flag `--local` and as a result all the `cli dependencies` will point to your local copy of the repository, but in some cases this fails. Another use case could be when you require a third party team to test some of your modifications but you don't want them to know how to checkout the CLI repo and contributing to them.
A good way to cover the previous examples would be to generate a new release that includes the content of one or more specific branches and that can be easily installed using the [normal app creation flow](https://shopify.dev/docs/apps/tools/cli#getting-started).
To create a new experimental release:
1. Checkout the  `experimental` branch with `git checkout experimental`
2. Points the index and working tree to the `HEAD` of your branch with `git reset --hard <your-branch-name>`
3. Force push the changes to remote with `git push origin experimental -f`
4. Access the [CLI Experimental Shipit](https://shipit.shopify.io/shopify/cli/experimental) and push the _Deploy_ button

To create a new app using the `experimental` release run the command `npm init @shopify/app@experimental` which will create the app using the last `experimental` version. Please, note that anyone can overwrite the content of the `experimental` and generate a new release. In that cases, if you want to be sure that you or the people that need to test the release use the correct version, please locate it in the (npm registry)[https://www.npmjs.com/package/@shopify/cli?activeTab=versions] and create the app using it `npm init @shopify/app@0.0.0-experimental-20231009094413`
