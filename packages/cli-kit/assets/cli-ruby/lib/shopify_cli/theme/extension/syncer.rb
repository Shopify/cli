# frozen_string_literal: true

require_relative "syncer/extension_serve_job"
require_relative "syncer/operation"
require_relative "ignore_helper"

require "shopify_cli/thread_pool"

module ShopifyCLI
  module Theme
    module Extension
      class Syncer
        include ShopifyCLI::Theme::Extension::IgnoreHelper

        attr_accessor :pending_operations, :latest_sync, :ignore_filter

        def initialize(ctx, extension:, project:, specification_handler:, ignore_filter: nil)
          @ctx = ctx
          @extension = extension
          @project = project
          @specification_handler = specification_handler
          @ignore_filter = ignore_filter

          @pool = ThreadPool.new(pool_size: 1)
          @pending_operations = []

          extension.extension_files.each do |file|
            operation = Operation.new(file, :update)
            @pending_operations << operation if enqueueable?(operation)
          end

          @pending_operations_mutex = Mutex.new
          @latest_sync = Time.now - ExtensionServeJob::PUSH_INTERVAL
        end

        def enqueue_creates(files)
          operations = files.map { |file| Operation.new(file, :create) }
          enqueue_operations(operations)
        end

        def enqueue_updates(files)
          operations = files.map { |file| Operation.new(file, :update) }
          enqueue_operations(operations)
        end

        def enqueue_deletes(files)
          operations = files.map { |file| Operation.new(file, :delete) }
          enqueue_operations(operations)
        end

        def start
          @pool.schedule(job)
        end

        def shutdown
          @pool.shutdown
        end

        def pending_files
          pending_operations.map(&:file)
        end

        def any_operation?
          pending_operations.any?
        end

        def any_blocking_operation?
          pending_operations.any? { |operation| operation.delete? || operation.create? }
        end

        private

        def enqueueable?(operation)
          # Already enqueued or ignored
          return false if @pending_operations.include?(operation) || ignore_operation?(operation)

          true
        end

        def enqueue_operations(operations)
          @pending_operations_mutex.synchronize do
            operations.each { |f| @pending_operations << f if enqueueable?(f) }
          end
        end

        def job
          ExtensionServeJob.new(
            @ctx,
            syncer: self,
            extension: @extension,
            project: @project,
            specification_handler: @specification_handler
          )
        end
      end
    end
  end
end
