# frozen_string_literal: true

require "readline"
require "json"
require "cgi"

require "shopify_cli/theme/dev_server"

require_relative "theme_admin_api"
require_relative "repl/api"
require_relative "repl/auth_dev_server"
require_relative "repl/auth_middleware"

module ShopifyCLI
  module Theme
    class Repl
      attr_reader :ctx, :api, :storefront_digest, :secure_session_id

      HOST = "localhost"
      PORT = 9293

      def initialize(ctx)
        @ctx = ctx
        @api = Api.new(ctx, self)
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

        loop do
          input = Readline.readline("> ", true)
          output = liquid_eval(input)

          render(output)
        rescue StandardError => error
          ctx.puts("{{red:Shopify Liquid console error: #{error.message}}}")
          ctx.debug(error.backtrace)
        end
      end

      def authenticate(storefront_digest, secure_session_id)
        @storefront_digest = storefront_digest
        @secure_session_id = secure_session_id
      end

      private

      def render(output)
        output = output ? JSON.pretty_generate(output) : "nil"

        ctx.puts("{{cyan:#{output}}}")
      end

      def url
        "http://#{HOST}:#{PORT}"
      end

      def liquid_eval(liquid_snippet)
        render_result(liquid_snippet) || render_context(liquid_snippet)
      end

      def render_result(liquid_snippet)
        entry_str = as_rendered_json(liquid_snippet)
        response = request(entry_str)

        return nil unless success?(response)

        json = json_from_response(response)
        json.last["value"]
      end

      def render_context(liquid_snippet)
        entry_str = as_context_json(liquid_snippet)
        response = request(entry_str)

        @session << JSON.parse(entry_str) if success?(response)

        nil
      end

      def request(entry_str)
        request_body = @session
          .map(&:to_json)
          .push(entry_str)
          .join(",")

        response = api.request("[#{request_body}]")

        if unauthorized?(response) || forbidden?(response)
          ctx.puts("{{red:Session expired.}}")
          raise ShopifyCLI::AbortSilent
        end

        response
      end

      def success?(response)
        response.code == "200"
      end

      def unauthorized?(response)
        response.code == "401"
      end

      def forbidden?(response)
        response.code == "403"
      end

      def json_from_response(response)
        json_str = response.body.lines[1..-2].join.strip
        JSON.parse(json_str)
      end

      def as_rendered_json(liquid_snippet)
        as_json_str("render", "{{ #{liquid_snippet} | json }}")
      end

      def as_context_json(liquid_snippet)
        as_json_str("context", "\"{% #{liquid_snippet} %}\"")
      end

      def as_json_str(type, value)
        <<~JSON
          { "type": "#{type}", "value": #{value} }
        JSON
      end

      def authenticate!
        # Currently, Shopify CLI can't bypass the store password, so the
        # `AuthDevServer` gets the session to perform  requests at the SFR.
        ShopifyCLI::Theme::Repl::AuthDevServer.start(ctx, self, PORT)
      end
    end
  end
end
