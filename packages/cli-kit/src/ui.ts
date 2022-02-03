import enquirer from 'enquirer';

export interface Question {
  type: 'input';
  name: string;
  message: string;
}

export const prompt = <T>(questions: Question[]): Promise<T> => {
  return enquirer.prompt(questions);
};
