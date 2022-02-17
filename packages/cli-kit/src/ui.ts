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
  output: string;
}
export interface Context {}

interface ListTask {
  title: string;
  task: (ctx: Context, task: Task) => Promise<void>;
}

interface ListOptions {
  concurrent?: boolean;
}

export const list = async (
  tasks: ListTask[],
  options?: ListOptions,
): Promise<void> => {
  await new Listr(tasks, options).run();
};
