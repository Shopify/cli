require "shopify_cli"

module ShopifyCLI
  module Commands
    Registry = CLI::Kit::CommandRegistry.new(
      default: "help",
      contextual_resolver: nil,
    )
    @core_commands = []

    def self.register(const, cmd, path = nil, is_core = false)
      autoload(const, path) if path
      Registry.add(->() { const_get(const) }, cmd)
      @core_commands.push(cmd) if is_core
    end

    def self.core_command?(cmd)
      @core_commands.include?(cmd)
    end
  end
end
