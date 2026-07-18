const { spawn } = require('node:child_process');

const children = [];

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...options,
  });
  children.push(child);
  child.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code;
    stopAll();
  });
  return child;
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

start(process.execPath, ['src/index.js'], {
  env: { ...process.env, PORT: '3001' },
});

const packageManager = process.env.npm_execpath;
if (packageManager) {
  start(process.execPath, [packageManager, '--prefix', 'frontend', 'run', 'dev'], {
    env: { ...process.env, NEXT_PUBLIC_CORIP_API_URL: 'http://localhost:3001' },
  });
} else {
  start('npm', ['--prefix', 'frontend', 'run', 'dev'], {
    env: { ...process.env, NEXT_PUBLIC_CORIP_API_URL: 'http://localhost:3001' },
  });
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
