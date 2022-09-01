package build

import (
	"bufio"
	"fmt"
	"io"
	"strings"
	"time"
)

func processLogs(reader io.Reader, handlers logProcessingHandlers) {
	buffer := strings.Builder{}
	fragments := make(chan string)
	done := make(chan struct{})
	flush := make(chan struct{})
	duration := time.Millisecond * 100
	timer := time.AfterFunc(duration, func() {
		flush <- struct{}{}
	})

	go func() {
		scanner := bufio.NewScanner(reader)
		scanner.Split(bufio.ScanLines)
		for scanner.Scan() {
			fragments <- fmt.Sprintf("%s", scanner.Text())
		}
		done <- struct{}{}
	}()

	for {
		select {
		case fragment := <-fragments:
			buffer.WriteString(fragment)
			timer.Reset(duration)
		case <-flush:
			if buffer.Len() > 0 {
				handlers.onMessage(buffer.String())
				buffer.Reset()
			}
		case <-done:
			if buffer.Len() > 0 {
				handlers.onMessage(buffer.String())
			}
			timer.Stop()
			handlers.onCompletion()
			return
		}
	}
}

type logProcessingHandlers struct {
	onCompletion func()
	onMessage    func(message string)
}
