package create

import (
	"log"
)

func NewProcess(tasks ...Task) Process {
	return Process{
		tasks:  tasks,
		status: make([]string, len(tasks)),
	}
}

type Process struct {
	tasks  []Task
	status []string
}

func (p *Process) Run() (err error) {
	for taskId, task := range p.tasks {
		if err = task.Run(); err != nil {
			p.status[taskId] = "fail"
			if undoErr := p.Undo(); undoErr != nil {
				log.Printf("Failed to undo with error: %v", undoErr)
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

func (p *Process) Add(task Task) {
	p.tasks = append(p.tasks, task)
	p.status = append(p.status, "")
}

type Task interface {
	Run() error
	Undo() error
}
