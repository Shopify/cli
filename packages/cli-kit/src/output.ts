import pc from 'picocolors';

export const success = (content: string) => {
  console.log(pc.green(`🎉 ${content}`));
};
