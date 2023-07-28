# frozen_string_literal: true

module ShopifyCLI
  module Theme
    class Repl
      class Snippet
        attr_reader :ctx, :api, :session, :input

        def initialize(ctx, api, session, input)
          @ctx = ctx
          @api = api
          @session = session
          @input = input
        end

        def render
          return delimiter_warning if has_delimiter?(input)

          output = evaluator.evaluate
          output = present(output)

          ctx.puts(output)
        end

        private

        def present(output)
          return json_error if json_error?(output)
          return empty if output.nil?

          output = JSON.pretty_generate(output)

          safe_cyan(output)
        end

        def evaluator
          @evaluator ||= RemoteEvaluator.new(self)
        end

        def safe_cyan(str)
          "\e[36m#{str}\e[0m"
        end

        def empty
          safe_cyan("nil")
        end

        def has_delimiter?(input)
          input.match?(/\{\{|\}\}|\{\%|\%\}/)
        end

        def delimiter_warning
          ctx.puts("{{yellow:\n#{delimiter_warning_text}}}")
        end

        def delimiter_warning_text
          <<~WARN
            Liquid Console doesn't support Liquid delimiters such as '{{ ... }}' or '{% ... %}'.

            Please use 'collections.first' instead of '{{ collections.first }}'.
          WARN
        end

        def json_error?(output)
          case output
          when Hash
            output["error"]&.include?("json not allowed for this object")
          when Array
            json_error?(output.first)
          else
            false
          end
        end

        def json_error
          "{{yellow:Object cannot be printed, but you can access its fields. Read more at https://shopify.dev/docs/api/liquid.}}"
        end
      end
    end
  end
end
