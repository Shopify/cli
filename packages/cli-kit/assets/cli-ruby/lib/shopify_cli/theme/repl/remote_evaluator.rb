# frozen_string_literal: true

module ShopifyCLI
  module Theme
    class Repl
      class RemoteEvaluator
        extend Forwardable

        attr_reader :snippet

        def_delegators :snippet, :ctx, :api, :session, :input

        def initialize(snippet)
          @snippet = snippet
        end

        def evaluate
          catch(:result) do
            eval_result || eval_context || eval_assignment_context || eval_syntax_error
          end
        end

        private

        def eval_result
          ctx.debug("Evaluating result")

          json = <<~JSON
            { "type": "display", "value": {{ #{input} | json }} }
          JSON

          response = json_request(json)

          return nil unless success?(response)

          json = json_from_response(response)
          json.last["value"] if json
        end

        def eval_context
          ctx.debug("Evaluating context")

          json = <<~JSON
            { "type": "context", "value": "{% #{input.gsub(/"/, "\\\"")} %}" }
          JSON

          response = json_request(json)
          session << JSON.parse(json) if success?(response)

          nil
        end

        def eval_assignment_context
          ctx.debug("Evaluating assignment context")

          return unless smart_assignment?(input)

          input.prepend("assign ")
          ctx.puts("{{gray:> #{input}}}")

          eval_context
        end

        def eval_syntax_error
          ctx.debug("Evaluating syntax error")

          body = ""
          body = extract_body(request("{{ #{input} }}")) unless standard_assignment?(input)
          body = extract_body(request("{% #{input} %}")) unless has_liquid_error?(body)

          return unless has_liquid_error?(body)

          error = body.gsub(/ \(snippets\/eval line \d+\)/, "")

          ctx.puts("{{red:#{error}}}")

          nil
        end

        def json_from_response(response)
          JSON.parse(
            extract_body(response),
          )
        rescue StandardError
          nil
        end

        def json_request(json)
          request_body = <<~LIQUID
            [
              #{session.map(&:to_json).push(json).join(",").gsub('\"', '"')}
            ]
          LIQUID

          request(request_body)
        end

        def request(request_body)
          response = api.request(request_body)

          expired_session_error if expired_session?(response)
          too_many_requests_error if too_many_requests?(response)
          not_found_error if not_found?(response)

          response
        end

        def smart_assignment?(input)
          /^\s*((?-mix:\(?[\w\-\.\[\]]\)?)+)\s*=\s*(.*)\s*/m.match?(input)
        end

        def standard_assignment?(input)
          /^\s*assign\s*((?-mix:\(?[\w\-\.\[\]]\)?)+)\s*=\s*(.*)\s*/m.match?(input)
        end

        def has_liquid_error?(body)
          body.match?(/\ALiquid (syntax )?error/)
        end

        def success?(response)
          response.code == "200" && !has_liquid_error?(extract_body(response))
        end

        def expired_session?(response)
          response.code == "401" || response.code == "403"
        end

        def too_many_requests?(response)
          response.code == "430" || response.code == "429"
        end

        def extract_body(response)
          response.body.lines[1..-2].join.strip
        end

        def not_found?(response)
          # Section Rendering API returns 200 even on unknown paths.
          response.header["server-timing"]&.include?("pageType;desc=\"404\"")
        end

        def expired_session_error
          ctx.puts("{{red:Session expired. Please initiate a new one.}}")
          raise ShopifyCLI::AbortSilent
        end

        def too_many_requests_error
          ctx.puts("{{red:Evaluations limit reached. Try again later.}}")
          raise ShopifyCLI::AbortSilent
        end

        def not_found_error
          ctx.puts("{{red:Page not found. Please provide a valid --url value.}}")
          raise ShopifyCLI::AbortSilent
        end
      end
    end
  end
end
