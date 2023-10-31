# frozen_string_literal: true

require "shopify_cli/theme/repl"

module Theme
  class Command
    class Console < ShopifyCLI::Command::SubCommand
      options do |parser, flags|
        parser.on("--url=URL") { |url| flags[:url] = url }
        parser.on("--port=PORT") { |port| flags[:port] = port }
        parser.on("--theme=THEME") { |theme| flags[:theme] = theme }
      end

      def call(_args, _name)
        url = options.flags[:url]
        port = options.flags[:port]
        theme = options.flags[:theme]

        ShopifyCLI::Theme::Repl.new(@ctx, url, port, theme).run
      end
    end
  end
end
