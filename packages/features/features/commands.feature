Feature: Loading all commands

Scenario: No runtime errors happen when loading the CLI modules graph
   When I list the available commands
   Then I see all commands matching the snapshot
