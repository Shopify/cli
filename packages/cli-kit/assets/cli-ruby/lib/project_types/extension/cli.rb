# frozen_string_literal: true

require "pathname"
require "json"
require "yaml"

module Extension
  class PackageResolutionFailed < RuntimeError; end

  class Project < ShopifyCLI::ProjectType
    hidden_feature

    require Project.project_filepath("messages/messages")
    require Project.project_filepath("messages/message_loading")
    require Project.project_filepath("extension_project_keys")
    register_messages(Extension::Messages::MessageLoading.load)
  end

  class Command < ShopifyCLI::Command::ProjectCommand
    autoload :ExtensionCommand, Project.project_filepath("commands/extension_command")

    subcommand :Serve, "serve", Project.project_filepath("commands/serve")
  end
  ShopifyCLI::Commands.register("Extension::Command", "extension")

  module Tasks
    autoload :ConfigureFeatures, Project.project_filepath("tasks/configure_features")
    autoload :ConfigureOptions, Project.project_filepath("tasks/configure_options")
    autoload :FetchSpecifications, Project.project_filepath("tasks/fetch_specifications")

    module Converters
      autoload :VersionConverter, Project.project_filepath("tasks/converters/version_converter")
      autoload :ValidationErrorConverter, Project.project_filepath("tasks/converters/validation_error_converter")
    end
  end

  module Features
    module Runtimes
      autoload :Base, Project.project_filepath("features/runtimes/base")
      autoload :CheckoutUiExtension, Project.project_filepath("features/runtimes/checkout_ui_extension")
    end

    autoload :ArgoServe, Project.project_filepath("features/argo_serve")
    autoload :ArgoServeOptions, Project.project_filepath("features/argo_serve_options")
    autoload :ArgoSetup, Project.project_filepath("features/argo_setup")
    autoload :ArgoSetupStep, Project.project_filepath("features/argo_setup_step")
    autoload :ArgoSetupSteps, Project.project_filepath("features/argo_setup_steps")
    autoload :ArgoDependencies, Project.project_filepath("features/argo_dependencies")
    autoload :ArgoConfig, Project.project_filepath("features/argo_config")
    autoload :ArgoRuntime, Project.project_filepath("features/argo_runtime")
    autoload :Argo, Project.project_filepath("features/argo")
  end

  module Models
    module SpecificationHandlers
      autoload :Default, Project.project_filepath("models/specification_handlers/default")
    end

    autoload :App, Project.project_filepath("models/app")
    autoload :LazySpecificationHandler, Project.project_filepath("models/lazy_specification_handler")
    autoload :Specification, Project.project_filepath("models/specification")
    autoload :Specifications, Project.project_filepath("models/specifications")
    autoload :ValidationError, Project.project_filepath("models/validation_error")
    autoload :Version, Project.project_filepath("models/version")
  end

  autoload :ExtensionProjectKeys, Project.project_filepath("extension_project_keys")
  autoload :ExtensionProject, Project.project_filepath("extension_project")
  autoload :Errors, Project.project_filepath("errors")

  module Loaders
    autoload :Project, Extension::Project.project_filepath("loaders/project")
    autoload :SpecificationHandler, Extension::Project.project_filepath("loaders/specification_handler")
  end
end
