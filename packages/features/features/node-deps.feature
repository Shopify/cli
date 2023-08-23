Feature: Node Dependencies

Scenario: Shared node dependencies are in sync across packages
   When I look at the package.json files in all packages
   Then I see all shared node dependencies on the same version
