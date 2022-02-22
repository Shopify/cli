require 'yaml'

config = YAML.load(STDIN.read).tap do |config|
  config['type'] = 'integration_test'
  config['development'] ||= {}
  config['development']['entries'] ||= {
    'main' => 'src/index.tsx'
  }
end

puts({ 'extensions' => [config] }.to_yaml)
