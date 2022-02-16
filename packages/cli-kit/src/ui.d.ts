export interface Question {
  type: 'input';
  name: string;
  message: string;
  default?: string;
}
export declare const prompt: <T>(questions: Question[]) => Promise<T>;
export interface Task {
  title: string;
}
export interface Context {}
interface ListTask {
  title: string;
  task: (ctx: Context, task: Task) => Promise<void>;
}
export declare const list: (tasks: ListTask[]) => Promise<Context>;
export {};
