Feature: The app command

  Scenario: The user wants to create a rails app
    Given I have a VM with the CLI and a working directory
    When I create a rails app named MyRailsApp in the VM
      Then the app has an environment file with SHOPIFY_API_KEY set to public_api_key
      Then the app has an environment file with SHOPIFY_API_SECRET set to api_secret_key
      Then the app has a yaml file to specify a node project type

  Scenario: The user wants to create a node app
    Given I have a VM with the CLI and a working directory
    When I create a node app named MyNodeApp in the VM
      Then the app has an environment file with SHOPIFY_API_KEY set to public_api_key
      Then the app has an environment file with SHOPIFY_API_SECRET set to api_secret_key
      Then the app has a yaml file to specify a node project type
