import inquirer from 'inquirer';
import type {Answers, QuestionCollection} from 'inquirer';

export const prompt = <T extends Answers = Answers>(
  questions: QuestionCollection<T>,
  initialAnswers?: Partial<T>,
): Promise<T> => {
  return inquirer.prompt(questions, initialAnswers);
};
