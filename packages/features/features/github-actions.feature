Feature: Github Actions

Scenario: All non-official github actions are pinned
   When I look at the github actions we use
   Then I see all non-official actions being pinned
