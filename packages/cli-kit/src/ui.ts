import enquirer from 'enquirer';
import {Listr} from 'listr2';

export interface Question {
  type: 'input';
  name: string;
  message: string;
  default?: string;
}

export const prompt = <T>(questions: Question[]): Promise<T> => {
  return enquirer.prompt(questions);
};

export interface Task {
  title: string;
}
export interface Context {}

interface ListTask {
  title: string;
  task: (ctx: Context, task: Task) => Promise<void>;
}

export const list = (tasks: ListTask[]) => {
  return new Listr(tasks).run();
};
