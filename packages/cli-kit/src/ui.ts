import enquirer from 'enquirer';
import {Listr} from 'listr2';

export interface Question {
  type: 'input';
  name: string;
  message: string;
}

export const prompt = <T>(questions: Question[]): Promise<T> => {
  return enquirer.prompt(questions);
};

interface ListTask {
  title: string;
  task: () => Promise<void>;
}

export const list = (tasks: ListTask[]) => {
  return new Listr(tasks).run();
};
