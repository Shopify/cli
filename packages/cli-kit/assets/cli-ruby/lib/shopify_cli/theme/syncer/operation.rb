# frozen_string_literal: true

module ShopifyCLI
  module Theme
    class Syncer
      class Operation
        attr_accessor :method, :file

        def initialize(ctx, method, file)
          @ctx = ctx
          @method = method
          @file = file
        end

        def to_s
          "#{method} #{file_path}"
        end

        def as_error_message
          as_message_with(status: :error)
        end

        def as_synced_message
          as_message_with(status: :synced)
        end

        def as_fix_message
          as_message_with(status: :fixed)
        end

        def file_path
          file&.relative_path
        end

        private

        def as_message_with(status:)
          text = @ctx.message("theme.serve.operation.status.#{status}").ljust(6)

          "{{gray:  • #{timestamp}}} #{text} {{>}} {{gray:#{self}}}"
        end

        def timestamp
          Time.now.strftime("%T")
        end
      end
    end
  end
end
