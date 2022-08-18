package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/Shopify/shopify-cli-extensions/api"
	"github.com/Shopify/shopify-cli-extensions/build"
	"github.com/Shopify/shopify-cli-extensions/core"
	"github.com/Shopify/shopify-cli-extensions/create"
	"github.com/Shopify/shopify-cli-extensions/logging"
)

var ctx context.Context

//go:generate make update-version
const version = "v0.0.0"

func init() {
	ctx = context.Background()
	logging.Init()
}

func main() {
	cli := CLI{}
	if len(os.Args) < 3 {
		logging.LogEntry{
			Type:    logging.General_error,
			Payload: logging.ErrorPayload{Message: "Invalid CLI input: You need to provide at least 2 arguments"}}.WriteLog()
		os.Exit(1)
	}

	cmd, args := os.Args[1], os.Args[2:]

	if len(args) > 0 {
		config, err := loadConfigFrom(args[0])
		if err != nil {
			panic(err)
		}
		cli.config = config
		args = args[1:]
	}

	switch cmd {
	case "build":
		cli.build(args...)
	case "create":
		cli.create(args...)
	case "serve":
		cli.serve(args...)
	case "version":
		logging.LogEntry{
			Type:    logging.General_info,
			Payload: logging.InfoPayload{Message: version}}.WriteLog()
	}
}

type CLI struct {
	config *core.Config
}

func (cli *CLI) build(args ...string) {
	builds := len(cli.config.Extensions)
	results := make(chan build.Result)

	for _, extension := range cli.config.Extensions {
		go build.Build(extension, func(result build.Result) {
			results <- result
		})
	}

	failedBuilds := 0
	for i := 0; i < builds; i++ {
		result := <-results
		if !result.Success {
			buildErrorLog := logging.Build_error.CreateLogEntry(result.Extension.UUID, result.Message)
			buildErrorLog.WriteLog()
			buildErrorLog.WriteErrorLog()
			// fmt.Fprintln(os.Stderr, result)
			failedBuilds += 1
		} else {
			logging.Build_completed.CreateLogEntry(result.Extension.UUID, result.Message).WriteLog()
			// fmt.Println(result)
		}
	}

	if failedBuilds > 0 {
		os.Exit(1)
	} else {
		os.Exit(0)
	}
}

func (cli *CLI) create(args ...string) {
	for _, extension := range cli.config.Extensions {
		logging.Create_started.CreateLogEntry(extension.UUID, "Extension create command started").WriteLog()
		err := create.NewExtensionProject(extension)
		if err != nil {
			errorLog := logging.Create_error.CreateLogEntry(extension.UUID, err.Error())
			errorLog.WriteLog()
			errorLog.WriteErrorLog()
			panic(fmt.Errorf("failed to create a new extension: %w", err))
		}
		logging.Create_completed.CreateLogEntry(extension.UUID, "Extension create command completed").WriteLog()
	}
}

func (cli *CLI) serve(args ...string) {
	api := api.New(cli.config)

	for _, extension := range cli.config.Extensions {
		go build.Watch(extension, func(result build.Result) {
			if result.Success {
				logging.Serve_completed.CreateLogEntry(result.Extension.UUID, result.Message).WriteLog()
				//fmt.Println(result)
			} else {
				errorLog := logging.Serve_error.CreateLogEntry(result.Extension.UUID, result.Message)
				errorLog.WriteLog()
				errorLog.WriteErrorLog()
				//fmt.Fprintln(os.Stderr, result)
			}

			api.Notify([]core.Extension{result.Extension})
		})

		go build.WatchLocalization(ctx, extension, func(result build.Result) {
			if result.Success {
				api.Notify([]core.Extension{result.Extension})
				logging.Serve_completed.CreateLogEntry(result.Extension.UUID, result.Message).WriteLog()
				//fmt.Println(result)
			} else {
				errorLog := logging.Serve_error.CreateLogEntry(result.Extension.UUID, result.Message)
				errorLog.WriteLog()
				errorLog.WriteErrorLog()
				//fmt.Fprintln(os.Stderr, result)
			}
		})
	}

	addr := fmt.Sprintf(":%d", cli.config.Port)
	server := &http.Server{Addr: addr, Handler: api}

	onInterrupt(func() {
		api.Shutdown()
		server.Shutdown(ctx)
	})

	logging.LogEntry{
		Type:    logging.General_info,
		Payload: logging.InfoPayload{Message: fmt.Sprintf("Shopify CLI Extensions Server is now available at %s\n", api.GetDevConsoleUrl())}}.WriteLog()

	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		panic(err)
	}
}

func loadConfigFrom(path string) (config *core.Config, err error) {
	var configSource io.ReadCloser

	if path == "-" {
		configSource = os.Stdin
	} else {
		configSource, err = os.Open(path)
		if err != nil {
			return
		}
		defer configSource.Close()
	}

	config, err = core.LoadConfig(configSource)
	if err != nil {
		panic(err)
	}

	return
}

func onInterrupt(handle func()) {
	interrupt := make(chan os.Signal)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-interrupt
		handle()
		os.Exit(0)
	}()
}
