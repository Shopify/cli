# frozen_string_literal: true

require "pathname"

module ShopifyCLI
  module Theme
    module Extension
      class Syncer
        class Operation < Struct.new(:file, :kind)
          def delete?
            kind == :delete
          end

          def create?
            kind == :create
          end

          def file_path
            file.relative_path
          end
        end
      end
    end
  end
end
