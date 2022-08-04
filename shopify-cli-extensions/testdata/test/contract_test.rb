# frozen_string_literal: true

require 'minitest/autorun'
require 'json'
require 'toml'

module ContractTest
  class TestMergeConfig < Minitest::Test

    def test_shopify_ui_extension_toml_contents
      assert File.exist?('tmp/integration_test/shopify.ui.extension.toml')

      extension_config_toml = TOML.load_file('tmp/integration_test/shopify.ui.extension.toml')
      type = extension_config_toml['type']
      name = extension_config_toml['name']
      extension_points = extension_config_toml['extension_points']
      metafields = extension_config_toml['metafields']
      development = extension_config_toml['development']
      development_build_env = development['build']['env']
      development_develop_env = development['develop']['env']

      assert_equal('integration_test', type)
      assert_equal('Integration Test', name)
      assert_equal(['Playground'], extension_points)
      assert_equal('my-namespace', metafields[0]['namespace'])
      assert_equal('my-key', metafields[0]['key'])
      assert_equal('bar', development_build_env['CUSTOM_VAR'])
      assert_equal('foo', development_develop_env['CUSTOM_VAR'])
    end

    def test_main_js_contents
      assert File.exist?('tmp/integration_test/build/main.js')

      assert File.readlines('tmp/integration_test/build/main.js')
                 .grep(/"My custom environment variable is:\s*"\s*,\s*"bar"/).any?
      assert File.readlines('tmp/integration_test/build/main.js')
                 .grep(/"My custom NODE_ENV is:\s*"\s*,\s*"production"/).any?
    end
  end
end
