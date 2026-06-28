import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { startStandaloneServer } from '@aisplinter/server';

const __dirname = dirname(fileURLToPath(import.meta.url));

config({ path: join(__dirname, '../.env') });
config();

await startStandaloneServer();
