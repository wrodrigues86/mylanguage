import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = path.resolve(projectRoot, 'build');
const output = path.resolve(buildRoot, 'full-project');

if (output === buildRoot || !output.startsWith(`${buildRoot}${path.sep}`)) {
  throw new Error('Invalid full project build output path.');
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
execFileSync(npmCommand, ['run', 'build', '--workspace', 'frontend'], {
  cwd: projectRoot,
  env: { ...process.env, VITE_API_URL: process.env.VITE_API_URL || '/api' },
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const directories = [
  ['backend/src', 'backend/src'],
  ['backend/assets', 'backend/assets'],
  ['frontend/src', 'frontend/src'],
  ['frontend/public', 'frontend/public'],
  ['frontend/build', 'frontend/build'],
  ['scripts', 'scripts'],
];

for (const [source, destination] of directories) {
  await cp(path.join(projectRoot, source), path.join(output, destination), { recursive: true });
}

const files = [
  'package.json',
  'package-lock.json',
  'docker-compose.yml',
  'Dockerfile',
  '.dockerignore',
  '.gitignore',
  'README.md',
  'backend/.env.example',
  'backend/Dockerfile',
  'backend/package.json',
  'frontend/Dockerfile',
  'frontend/index.html',
  'frontend/nginx.conf',
  'frontend/package.json',
];

for (const file of files) {
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await copyFile(path.join(projectRoot, file), path.join(output, file));
}

console.log(`Full project build created at ${path.relative(projectRoot, output)}`);
