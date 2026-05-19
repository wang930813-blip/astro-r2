import 'dotenv/config';
import { spawn } from 'node:child_process';

const serverBuildPath =
  'build/server/nodejs_eyJydW50aW1lIjoibm9kZWpzIn0/index.js';

const child = spawn(
  process.execPath,
  ['node_modules/@react-router/serve/bin.js', serverBuildPath],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      HOST: process.env.HOST || '0.0.0.0',
      PORT: process.env.PORT || '3000',
    },
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
