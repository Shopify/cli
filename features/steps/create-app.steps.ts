import {When} from '@cucumber/cucumber';

When(/I create an app named (.+)/, function (appName: string) {
  console.log(appName);
  // Write code here that turns the phrase above into concrete actions
});
