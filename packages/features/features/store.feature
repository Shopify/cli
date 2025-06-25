Feature: Store operations
  As a merchant
  I want to manage my store data
  So that I can copy, import, and export store information

  Background:
    Given I am logged into the Business Platform

  Scenario: Copy data between stores in the same organization
    Given I have a source store "source.myshopify.com"
    And I have a destination store "target.myshopify.com"
    And both stores are in the same organization
    When I run the store copy command with source "source.myshopify.com" and destination "target.myshopify.com"
    And I confirm the copy operation
    Then the copy operation should start successfully
    And I should see the copy progress
    And the copy should complete successfully
    And I should see a success message
