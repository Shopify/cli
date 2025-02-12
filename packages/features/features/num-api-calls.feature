Feature: Version Command API Calls
  Scenario: Check API calls made by version command
    When I run shopify version and count API calls
    Then shopify version less than or equal to 2 API calls
