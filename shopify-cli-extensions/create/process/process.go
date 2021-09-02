package process

import (
	"log"
)

func NewProcess(tasks ...Task) Process {
	return Process{
		tasks:  tasks,
		status: make([]string, len(tasks)),
	}
}

func (p *Process) Run() (err error) {
	for taskId, task := range p.tasks {
		if err = task.Run(); err != nil {
			p.status[taskId] = "fail"
			if undoErr := p.Undo(); undoErr != nil {
				log.Printf("Failed to undo with error: %v\n", undoErr)
			}
			return
		}
		p.status[taskId] = "success"
	}
	return
}

func (p *Process) Undo() (err error) {
	for taskId := range p.status {
		taskId = len(p.status) - 1 - taskId
		if p.status[taskId] == "fail" {
			return p.tasks[taskId].Undo()
		}
	}
	return
}

type Task struct {
	Run  func() error
	Undo func() error
}

type Process struct {
	tasks  []Task
	status []string
}
