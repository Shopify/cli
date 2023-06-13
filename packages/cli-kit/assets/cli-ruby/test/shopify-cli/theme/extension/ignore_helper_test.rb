# frozen_string_literal: true

require "test_helper"
require "shopify_cli/theme/extension/ignore_helper"

module ShopifyCLI
  module Theme
    class IgnoreHelperTest < Minitest::Test
      include ShopifyCLI::Theme::Extension::IgnoreHelper

      attr_reader :ignore_filter

      def test_ignore_operation_when_the_path_is_ignored
        path = mock
        operation = stub(file_path: path)

        expects(:ignore_path?).with(path).returns(true)

        assert(ignore_operation?(operation))
      end

      def test_ignore_operation_when_the_path_is_not_ignored
        path = mock
        operation = stub(file_path: path)

        expects(:ignore_path?).with(path).returns(false)

        refute(ignore_operation?(operation))
      end

      def test_ignore_file_when_the_path_is_ignored
        relative_path = mock
        file = stub(relative_path: relative_path)

        expects(:ignore_path?).with(relative_path).returns(true)

        assert(ignore_file?(file))
      end

      def test_ignore_file_when_the_path_is_not_ignored
        relative_path = mock
        file = stub(relative_path: relative_path)

        expects(:ignore_path?).with(relative_path).returns(false)

        refute(ignore_file?(file))
      end
    end
  end
end
