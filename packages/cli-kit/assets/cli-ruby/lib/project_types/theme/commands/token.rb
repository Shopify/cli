# frozen_string_literal: true

module Theme
  class Command
    class Token < ShopifyCLI::Command::SubCommand
      options do |parser, flags|
        parser.on("--admin ADMIN_TOKEN") { |token| flags[:admin_token] = token }
        parser.on("--sfr STOREFRONT_RENDERER_TOKEN") { |token| flags[:sfr_token] = token }
      end

      def call(_args, _name)
        admin_token = options.flags[:admin_token]
        sfr_token = options.flags[:sfr_token]
        ShopifyCLI::DB.set(shopify_exchange_token: admin_token) if admin_token
        ShopifyCLI::DB.set(storefront_renderer_production_exchange_token: sfr_token) if sfr_token
      end
    end
  end
end
