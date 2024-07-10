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

    def test_check_or_prompt_report_automatically_returns_false_when_the_environment_is_development
      # Given
      ShopifyCLI::Environment.expects(:development?).returns(true)

      # When
      got = ReportingConfigurationController.check_or_prompt_report_automatically(context: @context)

      # Then
      refute got
    end

    def test_check_or_prompt_report_automatically_returns_false_when_the_environment_is_test
      # Given
      ShopifyCLI::Environment.expects(:development?).returns(false)
      ShopifyCLI::Environment.expects(:test?).returns(true)

      # When
      got = ReportingConfigurationController.check_or_prompt_report_automatically(context: @context)

      # Then
      refute got
    end

    def test_check_or_prompt_report_automatically_returns_false_when_the_environment_is_not_interactive
      # Given
      ShopifyCLI::Environment.expects(:test?).returns(false)
      ShopifyCLI::Environment.expects(:development?).returns(false)
      ShopifyCLI::Environment.expects(:interactive?).returns(false)

      # When
      got = ReportingConfigurationController.check_or_prompt_report_automatically(context: @context)

      # Then
      refute got
    end

  end
end
