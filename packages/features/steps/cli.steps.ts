import {Then} from '@cucumber/cucumber'

Then(/I should be able to build the app at (.+)/, function (appName: string) {
  console.log(appName)
  // Write code here that turns the phrase above into concrete actions
})
