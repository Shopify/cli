require 'cli/ui'

module CLI
  module UI
    class ProgressPlain
      # Add a plain progress bar to the terminal output
      #
      # ==== Example Usage:
      #
      # Set the percent to X
      #   CLI::UI::ProgressPlain.progress do |bar|
      #     bar.tick(set_percent: percent)
      #   end
      def self.progress(prefix: "")
        bar = ProgressPlain.new(prefix: prefix)
        yield(bar)
      end

      # Initialize a plain progress bar. Typically used in a +ProgressPlain.progress+ block
      #
      def initialize(prefix: "")
        @percent_done = 0
        @prefix = prefix
      end

      # Set the progress of the bar. Typically used in a +ProgressPlain.progress+ block
      #
      # ==== Options
      # * +:set_percent+ - Set progress to a specific percent
      #
      # *Note:* The +:set_percent must be between 0.00 and 1.0
      #
      def tick(set_percent: nil)
        return if @percent_done >= 1.0 # Don't print if we're already done
        # Print only if we've moved up a whole 10% (e.g. 10%, 20%, 30%)q
        return if (@percent_done * 100).floor != 0 && ((@percent_done * 100).floor / 10 == (set_percent * 100).floor / 10)
        @percent_done = set_percent
        @percent_done = [@percent_done, 1.0].min # Make sure we can't go above 1.0

        print("#{to_s}\n")
      end

      # Format the progress bar to be printed to terminal
      #
      def to_s
        "#{@prefix} #{(@percent_done * 100).floor.to_s.rjust(5)}%"
      end
    end
  end
end
