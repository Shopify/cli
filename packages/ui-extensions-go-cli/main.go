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

	baseLogEntryBuilder := logging.Builder()
	validationLogBuilder := baseLogEntryBuilder.AddWorkflowSteps(logging.Config, logging.Validate)
	validationLogBuilder.SetStatus(logging.InProgress)
	validationLogBuilder.Build("Starting input validation").WriteLog(os.Stdout)
	if len(os.Args) < 3 {
		validationLogBuilder.Build("Invalid CLI input: You need to provide at least 2 arguments").WriteErrorLog(os.Stdout)
		os.Exit(1)
	}

	cmd, args := os.Args[1], os.Args[2:]

	if len(args) > 0 {
		config, err := loadConfigFrom(args[0])
		if err != nil {
			validationLogBuilder.SetStatus(logging.Failure)
			validationLogBuilder.Build(err.Error()).WriteErrorLog(os.Stdout)
			panic(err)
		}
		cli.config = config
		args = args[1:]
	}
	validationLogBuilder.SetStatus(logging.Success)
	validationLogBuilder.Build("Succesfully loaded configuration").WriteLog(os.Stdout)

	switch cmd {
	case "build":
		cli.build(args...)
	case "create":
		cli.create(args...)
	case "serve":
		cli.serve(args...)
	case "version":
		baseLogEntryBuilder.SetStatus(logging.Success)
		baseLogEntryBuilder.Build(version).WriteLog(os.Stdout)
	}
}

type CLI struct {
	config *core.Config
}

func (cli *CLI) build(args ...string) {

	logBuilder := logging.Builder().AddWorkflowSteps(logging.Build)
	builds := len(cli.config.Extensions)
	results := make(chan build.Result)

	for _, extension := range cli.config.Extensions {
		go build.Build(extension, func(result build.Result) {
			results <- result
		})
	}

	failedBuilds := 0
	for i := 0; i < builds; i++ {
		logBuilder.SetStatus(logging.InProgress)
		result := <-results
    logBuilder.SetExtensionId(result.Extension.UUID)
    logBuilder.SetExtensionName(result.Extension.Title)
		if !result.Success {
			logBuilder.SetStatus(logging.Failure)
			logBuilder.Build(result.Message).WriteErrorLog(os.Stdout)
			failedBuilds += 1
		} else {
			logBuilder.SetStatus(logging.Success)
			completedLog := logBuilder.Build(result.Message)
			completedLog.WriteLog(os.Stdout)
		}
	}

	if failedBuilds > 0 {
		os.Exit(1)
	} else {
		os.Exit(0)
	}
}

func (cli *CLI) create(args ...string) {
	logBuilder := logging.Builder().AddWorkflowSteps(logging.Create)
	logBuilder.SetStatus(logging.InProgress)
	for _, extension := range cli.config.Extensions {
    logBuilder.SetExtensionId(extension.UUID)
    logBuilder.SetExtensionName(extension.Title)
		logBuilder.Build("Extension create command started").WriteLog(os.Stdout)
		err := create.NewExtensionProject(extension)
		if err != nil {
			logBuilder.SetStatus(logging.Failure)
			errorLog := logBuilder.Build(err.Error())
			errorLog.WriteErrorLog(os.Stdout)
			panic(fmt.Errorf("failed to create a new extension: %w", err))
		}
		logBuilder.SetStatus(logging.Success)
		logBuilder.Build("Extension create command completed").WriteLog(os.Stdout)
	}
}

func (cli *CLI) serve(args ...string) {
	logBuilder := logging.Builder().AddWorkflowSteps(logging.Serve)

	api := api.New(cli.config, &logBuilder)

	for _, extension := range cli.config.Extensions {
		go build.Watch(extension, func(result build.Result) {
			logWatchBuilder := logBuilder.AddWorkflowSteps(logging.Build, logging.Watch, logging.Sources)
      logWatchBuilder.SetExtensionId(result.Extension.UUID)
      logWatchBuilder.SetExtensionName(result.Extension.Title)
			if result.Success {
				logWatchBuilder.SetStatus(logging.Success)
				logWatchBuilder.Build(result.Message).WriteLog(os.Stdout)
			} else {
				logWatchBuilder.SetStatus(logging.Failure)
				logWatchBuilder.Build(result.Message).WriteLog(os.Stdout)
			}
			api.Notify([]core.Extension{result.Extension})
		})

		go build.WatchLocalization(ctx, extension, func(result build.Result) {
			logWatchLocalizationBuilder := logBuilder.AddWorkflowSteps(logging.Build, logging.Watch, logging.Localization)
      logWatchLocalizationBuilder.SetExtensionId(result.Extension.UUID)
      logWatchLocalizationBuilder.SetExtensionName(result.Extension.Title)
			if result.Success {
				logWatchLocalizationBuilder.SetStatus(logging.Success)
				logCompleted := logWatchLocalizationBuilder.Build(result.Message)
				logCompleted.WriteLog(os.Stdout)
			} else {
				logWatchLocalizationBuilder.SetStatus(logging.Failure)
				logWatchLocalizationBuilder.Build(result.Message).WriteLog(os.Stdout)
			}
		})
	}

	addr := fmt.Sprintf(":%d", cli.config.Port)
	server := &http.Server{Addr: addr, Handler: api}

	onInterrupt(func() {
		api.Shutdown()
		server.Shutdown(ctx)
	})

  logServerBuilder := logBuilder.AddWorkflowSteps(logging.Server)
	logServerBuilder.SetStatus(logging.Success)
	logServerBuilder.Build(fmt.Sprintf("Shopify CLI Extensions Server is now available at %s", api.GetDevConsoleUrl())).WriteLog(os.Stdout)
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		logServerBuilder.SetStatus(logging.Failure)
		logServerBuilder.Build(err.Error()).WriteErrorLog(os.Stdout)
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
