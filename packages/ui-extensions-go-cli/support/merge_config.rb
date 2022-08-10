require 'yaml'
require 'toml-rb'

config = TomlRB.parse(STDIN.read).tap do |config|
  config['type'] = 'integration_test'
  config['node_executable'] = File.expand_path("../../ui-extensions-cli/bin/cli.js", __dir__)
  config['development'] ||= {}
  config['development']['build_dir'] = 'build'
  config['development']['root_dir'] = 'tmp/integration_test'
  config['development']['template'] = 'javascript-react'
  config['development']['entries'] ||= {
    'main' => 'src/index.jsx'
  }
  config['development']['renderer'] ||= {
    'name' => '@shopify/checkout-ui-extensions',
    'version' => '0.17.1'
  }
end

puts({ 'extensions' => [config] }.to_yaml)
