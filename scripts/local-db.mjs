import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';
const databaseDir = path.resolve('.local/postgres');
const pg = new EmbeddedPostgres({ databaseDir, user: 'my_flux', password: 'my_flux_local', port: 55432, persistent: true, authMethod: 'scram-sha-256', postgresFlags: ['-h', '127.0.0.1'], initdbFlags: ['--encoding=UTF8', '--locale=C'] });
if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const result = await client.query("SELECT 1 FROM pg_database WHERE datname = 'my_flux'");
await client.end();
if (!result.rowCount) await pg.createDatabase('my_flux');
console.log('MY FLUX PostgreSQL disponível em 127.0.0.1:55432');
async function stop() { await pg.stop(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
setInterval(() => {}, 60_000);
