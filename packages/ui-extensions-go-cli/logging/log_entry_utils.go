package logging

type WorkflowStep string

const (
	Serve        WorkflowStep = "serve"
	Api          WorkflowStep = "api"
	Server       WorkflowStep = "server"
	Build        WorkflowStep = "build"
	Watch        WorkflowStep = "watch"
	Localization WorkflowStep = "localization"
	Sources      WorkflowStep = "sources"
	Create       WorkflowStep = "create"
	Config       WorkflowStep = "config"
	Validate     WorkflowStep = "validate"
)

type LogStatus string

const (
	InProgress LogStatus = "inProgress"
	Failure    LogStatus = "failure"
	Success    LogStatus = "success"
)

type LogLevel string

const (
	Info  LogLevel = "info"
	Error LogLevel = "error"
)
