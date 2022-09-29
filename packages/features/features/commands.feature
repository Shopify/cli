Feature: Loading all commands

Scenario: No runtime errors happen when loading the CLI modules graph
   Then I see all available commands and they match the snapshot
