# frozen_string_literal: true

require "test_helper"
require "rack/mock"

require "shopify_cli/theme/repl/remote_evaluator"

module ShopifyCLI
  module Theme
    class Repl
      class RemoteEvaluatorTest < Minitest::Test
        def test_print_syntax_error
          remote_error = "Liquid syntax error: Unexpected character + in \"{{ a + b }}\""
          expected_error = "{{red:#{remote_error}}}"

          ctx.expects(:puts).with(expected_error)

          evaluator("a + b").send(:print_syntax_error, remote_error)
        end

        def test_print_syntax_error_with_unknown_tag_error
          remote_error = "Unknown tag 'unknown_object'"
          expected_error = "{{red:Unknown object, property, tag, or filter: 'unknown_object'}}"

          ctx.expects(:puts).with(expected_error)

          evaluator("unknown_object").send(:print_syntax_error, remote_error)
        end

        private

        def evaluator(input)
          @evaluator ||= RemoteEvaluator.new(
            stub(input: input, ctx: ctx)
          )
        end

        def ctx
          @ctx ||= mock
        end
      end
    end
  end
end
