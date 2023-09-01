# frozen_string_literal: true

require "cgi"
require "forwardable"
require "json"
require "readline"

require "shopify_cli/theme/dev_server"

require_relative "theme_admin_api"
require_relative "repl/api"
require_relative "repl/auth_dev_server"
require_relative "repl/auth_middleware"
require_relative "repl/remote_evaluator"
require_relative "repl/snippet"

module ShopifyCLI
  module Theme
    class Repl
      attr_reader :ctx, :url, :port, :session, :storefront_digest, :secure_session_id

      def initialize(ctx, url, port)
        @ctx = ctx
        @url = url
        @port = port
        @session = []
      end

      def run
        authenticate!

        ctx.puts <<~MSG
          Welcome to Shopify Liquid console
          (press Ctrl + C to exit)

        MSG

        trap("INT") { raise ShopifyCLI::AbortSilent }
        trap("TERM") { raise ShopifyCLI::AbortSilent }

        loop { repl }
      end

      def authenticate(storefront_digest, secure_session_id)
        @storefront_digest = storefront_digest
        @secure_session_id = secure_session_id
      end

      private

      def repl
        snippet.render
      rescue StandardError => error
        shutdown_session(error)
      end

      def snippet
        Snippet.new(ctx, api, session, input)
      end

      def input
        Readline.readline("> ", true)
      end

      def shutdown_session(error)
        message = error.message
        backtrace = error.backtrace
        error_message = "{{red:Shopify Liquid console error: #{message}}}"

        ctx.puts(error_message)
        ctx.debug(backtrace)

        raise ShopifyCLI::AbortSilent
      end

      def authenticate!
        # Currently, Shopify CLI can't bypass the store password, so the
        # `AuthDevServer` gets the session to perform requests at the SFR.
        ShopifyCLI::Theme::Repl::AuthDevServer.start(ctx, self, port)
      end

      def api
        @api ||= Api.new(ctx, url, self)
      end
    end
  end
end
