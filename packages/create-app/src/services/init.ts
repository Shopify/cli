import {Plop, run} from 'plop';
import {path} from '@shopify/support';
import Listr from 'listr';
import minimist from 'minimist';
// import {cliVersion as getCliVersion} from "../utils/versions";

interface InitOptions {
  name?: string;
  directory: string;
  templatePath: string;
}

async function init(_: InitOptions) {
  // const cliVersion = await getCliVersion();
  const args = process.argv.slice(2);
  const argv = minimist(args);
  const plopWorkflow = [
    {
      title: 'Creating app',
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
