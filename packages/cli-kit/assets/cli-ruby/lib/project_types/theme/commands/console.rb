# frozen_string_literal: true

require "shopify_cli/theme/repl"

module Theme
  class Command
    class Console < ShopifyCLI::Command::SubCommand
      recommend_default_ruby_range

      def call(_args, *)
        ShopifyCLI::Theme::Repl.new(@ctx).run
      end
    end
  end
end
