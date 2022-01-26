import {Plop, run} from 'plop';
import {path} from '@shopify/support';
import Listr from 'listr';
import minimist from 'minimist';

async function init(name: string, templatePath: string) {
  console.log(name);
  console.log(templatePath);

  const args = process.argv.slice(2);
  const argv = minimist(args);
  const plopWorkflow = [
    {
      title: 'Creating from Basic App Template',
      task: () =>
        Plop.launch(
          {
            cwd: process.cwd(),
            configPath: path.join(__dirname, '../../templates/app-plopfile.js'),
            require: argv.require,
            completion: argv.completion,
          },
          (env) => {
            const options = {
              ...env,
              dest: process.cwd(),
            };
            return run(options, undefined, true);
          },
        ),
    },
  ];

  const tasks = new Listr(plopWorkflow);

  tasks
    .run()
    .then(() => {
      console.log('The app has been successfully created');
    })
    .catch((err) => {
      console.error(err);
    });
}

export default init;
