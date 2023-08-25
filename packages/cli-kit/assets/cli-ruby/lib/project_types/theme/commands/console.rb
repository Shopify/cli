# frozen_string_literal: true

require "shopify_cli/theme/repl"

module Theme
  class Command
    class Console < ShopifyCLI::Command::SubCommand
      options do |parser, flags|
        parser.on("--url=URL") { |url| flags[:url] = url }
        parser.on("--port=PORT") { |port| flags[:port] = port }
      end

      def call(_args, _name)
        url = options.flags[:url]
        port = options.flags[:port]

        ShopifyCLI::Theme::Repl.new(@ctx, url, port).run
      end
    end
  end
end
