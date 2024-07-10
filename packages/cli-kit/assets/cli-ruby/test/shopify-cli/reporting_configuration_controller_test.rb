require "test_helper"

module ShopifyCLI
  class ReportingConfigurationControllerTest < MiniTest::Test
    def setup
      super
      @context = TestHelpers::FakeContext.new
    end

    def test_enable_reporting_returns_the_right_value
      # Given
      ShopifyCLI::Config
        .expects(:set)
        .with(
          Constants::Config::Sections::Analytics::NAME,
          Constants::Config::Sections::Analytics::Fields::ENABLED,
          true
        )

      # When/Then
      ReportingConfigurationController.enable_reporting(true)
    end
  end
end
