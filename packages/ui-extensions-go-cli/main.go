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
	baseLogEntryBuilder := logging.NewLogEntryBuilder()
	cli := CLI{}

	validationLogBuilder := baseLogEntryBuilder.AddContext(logging.Config).AddContext(logging.Validate)
	validationLogBuilder.Build(logging.Started, "", "Starting input validation").WriteErrorLog(os.Stdout)
	if len(os.Args) < 3 {
		validationLogBuilder.Build(logging.Started, "", "Invalid CLI input: You need to provide at least 2 arguments").WriteErrorLog(os.Stdout)
		os.Exit(1)
	}

	cmd, args := os.Args[1], os.Args[2:]

	if len(args) > 0 {
		config, err := loadConfigFrom(args[0])
		if err != nil {
			validationLogBuilder.Build(logging.Failed, "", err.Error()).WriteErrorLog(os.Stdout)
			panic(err)
		}
		cli.config = config
		args = args[1:]
	}
	validationLogBuilder.Build(logging.Completed, "", "Succesfully loaded configuration").WriteLog(os.Stdout)

	switch cmd {
	case "build":
		cli.build(args...)
	case "create":
		cli.create(args...)
	case "serve":
		cli.serve(args...)
	case "version":
		baseLogEntryBuilder.Build(logging.Completed, "", version).WriteLog(os.Stdout)
	}
}

type CLI struct {
	config *core.Config
}

func (cli *CLI) build(args ...string) {
	logBuilder := logging.NewLogEntryBuilder().AddContext(logging.Build)
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
			logBuilder.Build(logging.Completed, result.Extension.UUID, result.Message).WriteErrorLog(os.Stdout)
			// fmt.Fprintln(os.Stderr, result)
			failedBuilds += 1
		} else {
			completedLog := logBuilder.Build(logging.Completed, result.Extension.UUID, result.Message)
			completedLog.WriteLog(os.Stdout)
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
	logBuilder := logging.NewLogEntryBuilder().AddContext(logging.Create)
	for _, extension := range cli.config.Extensions {
		logBuilder.Build(logging.Started, extension.UUID, "Extension create command started").WriteLog(os.Stdout)
		err := create.NewExtensionProject(extension)
		if err != nil {
			errorLog := logBuilder.Build(logging.Failed, extension.UUID, err.Error())
			errorLog.WriteErrorLog(os.Stdout)
			panic(fmt.Errorf("failed to create a new extension: %w", err))
		}
		logBuilder.Build(logging.Completed, extension.UUID, "Extension create command completed").WriteLog(os.Stdout)
	}
}

func (cli *CLI) serve(args ...string) {
	logBuilder := logging.NewLogEntryBuilder().AddContext(logging.Serve)

	api := api.New(cli.config)

	for _, extension := range cli.config.Extensions {
		go build.Watch(extension, func(result build.Result) {
			logWatchBuilder := logBuilder.AddContext(logging.Build).AddContext(logging.Watch)
			if result.Success {
				logWatchBuilder.Build(logging.Completed, result.Extension.UUID, result.Message).WriteLog(os.Stdout)
				//fmt.Println(result)
			} else {
				logWatchBuilder.Build(logging.Progress, result.Extension.UUID, result.Message).WriteLog(os.Stdout)
				//fmt.Fprintln(os.Stderr, result)
			}

			api.Notify([]core.Extension{result.Extension})
		})

		go build.WatchLocalization(ctx, extension, func(result build.Result) {
			logWatchLocalizationBuilder := logBuilder.AddContext(logging.Build).AddContext(logging.WatchLocalization)
			if result.Success {
				logCompleted := logWatchLocalizationBuilder.Build(logging.Completed, result.Extension.UUID, result.Message)
				logCompleted.WriteLog(os.Stdout)
				//fmt.Println(result)
			} else {
				logWatchLocalizationBuilder.Build(logging.Progress, result.Extension.UUID, result.Message).WriteLog(os.Stdout)
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

	logBuilder.Build(logging.Started, "", fmt.Sprintf("Shopify CLI Extensions Server is now available at %s\n", api.GetDevConsoleUrl())).WriteLog(os.Stdout)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		logBuilder.Build(logging.Failed, "", err.Error()).WriteErrorLog(os.Stdout)
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
