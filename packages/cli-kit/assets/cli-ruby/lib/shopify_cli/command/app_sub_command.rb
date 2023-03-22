module ShopifyCLI
  class Command
    class AppSubCommand < SubCommand
      def detect_app(directory: Dir.pwd)
        AppTypeDetector.detect(project_directory: directory)
      rescue ShopifyCLI::AppTypeDetector::TypeNotFoundError
        raise ShopifyCLI::Abort, @ctx.message("core.app.error.type_not_found", directory)
      rescue ShopifyCLI::AppTypeDetector::MissingShopifyCLIYamlError
        raise ShopifyCLI::Abort, @ctx.message("core.app.error.missing_shopify_cli_yml", directory)
      rescue ShopifyCLI::AppTypeDetector::InvalidTypeError => error
        raise ShopifyCLI::Abort, @ctx.message("core.app.error.invalid_project_type", error.project_type)
      end
    end
  end
end
