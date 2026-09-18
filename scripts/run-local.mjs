import { spawn } from 'node:child_process';
const root = new URL('../', import.meta.url);
const command = process.argv[2];
const env = { ...process.env, DATABASE_URL: 'postgresql://my_flux:my_flux_local@127.0.0.1:55432/my_flux', PORT: '3334', WEB_ORIGIN: 'http://localhost:5175', VITE_API_BASE_URL: 'http://localhost:3334/api/v1' };
const commands = { api: ['node_modules/tsx/dist/cli.mjs','watch','src/server.ts'], migrate: ['node_modules/prisma/build/index.js','migrate','deploy'], generate: ['node_modules/prisma/build/index.js','generate'], seed: ['node_modules/tsx/dist/cli.mjs','prisma/demo-seed.ts'], web: ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5175','--strictPort'] };
if (!commands[command]) throw new Error('Use api, web, migrate, generate ou seed.');
const child = spawn(process.execPath, commands[command], { cwd: new URL(command === 'web' ? 'apps/web/' : 'apps/api/', root), env, stdio: 'inherit', windowsHide: true });
child.on('exit', code => process.exit(code ?? 1));
