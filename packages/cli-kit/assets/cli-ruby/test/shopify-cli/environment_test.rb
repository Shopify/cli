# frozen_string_literal: true
require "test_helper"

module ShopifyCLI
  class EnvironmentTest < MiniTest::Test
    def setup
      super
      @mock_spin_instance = {
        "name": name,
        "fqdn": "#{name}.namespace.host",
      }
    end

    def test_ruby_version_when_the_command_raises
      # Given
      context = TestHelpers::FakeContext.new
      stat = mock("error", success?: false)
      out = ""
      context.expects(:capture2e)
        .with("ruby", "--version")
        .returns([out, stat])

      # When/Then
      error = assert_raises ShopifyCLI::Abort do
        Environment.ruby_version(context: context)
      end
      expected_error = "Ruby is required to continue. Install Ruby here: https://www.ruby-lang.org/en/downloads."
      assert_equal error.message, expected_error
    end

    def test_ruby_version
      # Given
      context = TestHelpers::FakeContext.new
      stat = mock("success", success?: true)
      out = "ruby 3.0.3p157 (2021-11-24 revision 3fb7d2cadc) [x86_64-darwin21]"
      context.expects(:capture2e)
        .with("ruby", "--version")
        .returns([out, stat])

      # When
      got = Environment.ruby_version(context: context)

      # Then
      assert_equal ::Semantic::Version.new("3.0.3"), got
    end

    def test_node_version_when_the_command_raises
      # Given
      context = TestHelpers::FakeContext.new
      stat = mock("error", success?: false)
      out = ""
      context.expects(:capture2e)
        .with("node", "--version")
        .returns([out, stat])

      # When/Then
      error = assert_raises ShopifyCLI::Abort do
        Environment.node_version(context: context)
      end
      expected_error = "Node.js is required to continue. Install Node.js here: https://nodejs.org/en/download."
      assert_equal error.message, expected_error
    end

    def test_node_version
      # Given
      context = TestHelpers::FakeContext.new
      stat = mock("success", success?: true)
      out = "v17.5.0"
      context.expects(:capture2e)
        .with("node", "--version")
        .returns([out, stat])

      # When
      got = Environment.node_version(context: context)

      # Then
      assert_equal ::Semantic::Version.new("17.5.0"), got
    end

    def test_npm_version
      # Given
      context = TestHelpers::FakeContext.new
      stat = mock("success", success?: true)
      out = "8.4.1"
      context.expects(:capture2e)
        .with("npm", "--version")
        .returns([out, stat])

      # When
      got = Environment.npm_version(context: context)

      # Then
      assert_equal ::Semantic::Version.new("8.4.1"), got
    end

    def test_rails_version_when_the_command_raises
      # Given
      context = TestHelpers::FakeContext.new
      stat = mock("error", success?: false)
      out = ""
      context.expects(:capture2e)
        .with("rails", "--version")
        .returns([out, stat])

      # When/Then
      error = assert_raises CLI::Kit::Abort do
        Environment.rails_version(context: context)
      end
      assert_equal "{{x}} Error installing rails gem", error.message
    end

    def test_rails_version
      # Given
      context = TestHelpers::FakeContext.new
      stat = mock("success", success?: true)
      out = "Rails 6.1.4.6"
      context.expects(:capture2e)
        .with("rails", "--version")
        .returns([out, stat])

      # When
      got = Environment.rails_version(context: context)

      # Then
      assert_equal ::Semantic::Version.new("6.1.4"), got
    end

    def test_use_local_partners_instance_returns_true_when_the_env_variable_is_set
      # Given
      env_variables = {
        Constants::EnvironmentVariables::LOCAL_PARTNERS.to_s => "1",
      }

      # When
      got = Environment.use_local_partners_instance?(env_variables: env_variables)

      # Then
      assert got
    end

    def test_auth_token_returns_the_right_value
      # Given
      env_variables = {
        Constants::EnvironmentVariables::AUTH_TOKEN.to_s => "token",
      }

      # When
      got = Environment.auth_token(env_variables: env_variables)

      # Then
      assert_equal "token", got
    end

    def test_admin_auth_token_returns_the_right_value
      # Given
      env_variables = {
        Constants::EnvironmentVariables::ADMIN_AUTH_TOKEN.to_s => "admin_token",
      }

      # When
      got = Environment.admin_auth_token(env_variables: env_variables)

      # Then
      assert_equal "admin_token", got
    end

    def test_storefront_renderer_auth_token_returns_the_right_value
      # Given
      env_variables = {
        Constants::EnvironmentVariables::STOREFRONT_RENDERER_AUTH_TOKEN.to_s => "storefront_renderer_token",
      }

      # When
      got = Environment.storefront_renderer_auth_token(env_variables: env_variables)

      # Then
      assert_equal "storefront_renderer_token", got
    end

    def test_store_returns_the_right_value
      # Given
      env_variables = {
        Constants::EnvironmentVariables::STORE.to_s => "store",
      }

      # When
      got = Environment.store(env_variables: env_variables)

      # Then
      assert_equal "store", got
    end

    def test_use_local_partners_instance_returns_false_when_the_env_variable_is_not_set
      # Given/When
      got = Environment.use_local_partners_instance?(env_variables: {})

      # Then
      refute got
    end

    def test_use_spin_returns_true_when_the_partners_env_variable_is_set
      # Given
      env_variables = {
        Constants::EnvironmentVariables::SPIN_PARTNERS.to_s => "1",
      }

      # When
      got = Environment.use_spin?(env_variables: env_variables)

      # Then
      assert got
    end

    def test_use_spin_returns_false_when_the_partners_env_variable_is_set
      # When
      got = Environment.use_spin?(env_variables: {})

      # Then
      refute got
    end

    def test_partners_domain_returns_the_right_value_when_production_instance
      # Given/When
      got = Environment.partners_domain

      # Then
      assert_equal "partners.shopify.com", got
    end

    def test_spin_url_returns_complete_override
      # Given
      env_variables = {
        Constants::EnvironmentVariables::SPIN.to_s => "1",
        Constants::EnvironmentVariables::SPIN_WORKSPACE.to_s => "abcd",
        Constants::EnvironmentVariables::SPIN_NAMESPACE.to_s => "namespace",
        Constants::EnvironmentVariables::SPIN_HOST.to_s => "host",
      }

      # When
      got = Environment.partners_domain(env_variables: env_variables)

      # Then
      assert_equal "partners.abcd.namespace.host", got
    end

    def test_spin_url_raises_partial_override
      # Given
      env_variables = {
        Constants::EnvironmentVariables::SPIN.to_s => "1",
        Constants::EnvironmentVariables::SPIN_WORKSPACE.to_s => "abcd",
        Constants::EnvironmentVariables::SPIN_NAMESPACE.to_s => "namespace",
      }

      # When/Then
      assert_raises(RuntimeError) do
        Environment.partners_domain(env_variables: env_variables)
      end
    end

    def test_spin_url_returns_specified_instance_url
      # Given
      env_variables = {
        Constants::EnvironmentVariables::SPIN.to_s => "1",
        Constants::EnvironmentVariables::SPIN_INSTANCE.to_s => "abcd",
      }
      Environment.expects(:spin_show).with.returns(@mock_spin_instance.to_json)

      # When
      got = Environment.partners_domain(env_variables: env_variables)

      # Then
      assert_equal "partners.#{@mock_spin_instance[:fqdn]}", got
    end

    def test_spin_url_returns_latest
      # Given
      env_variables = {
        Constants::EnvironmentVariables::SPIN_PARTNERS.to_s => "1",
      }
      Environment.expects(:spin_show).with(latest: true).returns(@mock_spin_instance.to_json)

      # When
      got = Environment.partners_domain(env_variables: env_variables)

      # Then
      assert_equal "partners.#{@mock_spin_instance[:fqdn]}", got
    end

    def test_use_spin_is_true
      env_variables = {
        Constants::EnvironmentVariables::SPIN.to_s => "1",
      }

      got = Environment.use_spin?(env_variables: env_variables)

      assert got
    end

    def test_use_spin_is_false
      env_variables = {
        Constants::EnvironmentVariables::SPIN.to_s => nil,
      }

      got = Environment.use_spin?(env_variables: env_variables)

      refute got
    end

    def test_use_monorail_is_true
      env_variables = {
        Constants::EnvironmentVariables::MONORAIL_REAL_EVENTS.to_s => "1",
      }

      got = Environment.send_monorail_events?(env_variables: env_variables)

      assert got
    end

    def test_using_monorail_is_false
      env_variables = {
        Constants::EnvironmentVariables::MONORAIL_REAL_EVENTS.to_s => "0",
      }

      got = Environment.send_monorail_events?(env_variables: env_variables)

      refute got
    end

    def test_run_as_subprocess_blocks_monorail
      env_variables = {
        Constants::EnvironmentVariables::MONORAIL_REAL_EVENTS.to_s => "1",
        Constants::EnvironmentVariables::RUN_AS_SUBPROCESS.to_s => "1",
      }

      got = Environment.send_monorail_events?(env_variables: env_variables)

      refute got
    end

    def test_env_variable_truthy
      Environment::TRUTHY_ENV_VARIABLE_VALUES.each do |value|
        assert Environment.env_variable_truthy?("TEST", env_variables: { "TEST" => value })
      end
      refute Environment.env_variable_truthy?("TEST", env_variables: {})
      refute Environment.env_variable_truthy?("TEST", env_variables: { "TEST" => "0" })
    end
  end
end
