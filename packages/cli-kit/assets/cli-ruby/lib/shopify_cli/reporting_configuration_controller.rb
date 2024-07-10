module ShopifyCLI
  module ReportingConfigurationController
    def self.enable_reporting(enabled)
      ShopifyCLI::Config.set(
        Constants::Config::Sections::Analytics::NAME,
        Constants::Config::Sections::Analytics::Fields::ENABLED,
        enabled
      )
    end

    def self.reporting_prompted?
      ShopifyCLI::Config.get_section(Constants::Config::Sections::Analytics::NAME).key?(
        Constants::Config::Sections::Analytics::Fields::ENABLED
      )
    end

    def self.reporting_enabled?
      ShopifyCLI::Config.get_bool(
        Constants::Config::Sections::Analytics::NAME,
        Constants::Config::Sections::Analytics::Fields::ENABLED,
        default: false
      )
    end

    def self.check_or_prompt_report_automatically(*)
      false
    end
  end
end
