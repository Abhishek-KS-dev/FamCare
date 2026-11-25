import express from 'express';
import type { Request, Response } from 'express';
import { initializeDatabase, getStorageStatus } from '../server/db/store.ts';
import { apiRouter } from '../server/routes/api.ts';

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.use('/api', apiRouter);

app.use('/api/*', (_req, res) => {
res.status(404).json({ error: 'API endpoint not found.' });
});

let initializationPromise: Promise<void> | null = null;

async function initialize() {
if (!initializationPromise) {
initializationPromise = initializeDatabase().then((status) => {
console.log("[FamCare] Database: ${status.mode} — ${status.notice}");

  if (status.mode !== 'mongodb') {
    throw new Error(
      `MongoDB is required in production. ${status.notice}`
    );
  }
}).catch((error) => {
  initializationPromise = null;
  throw error;
});

}

await initializationPromise;
}

export default async function handler(req: Request, res: Response) {
try {
await initialize();
return app(req, res);
} catch (error) {
console.error('[FamCare] Server initialization failed:', error);

return res.status(503).json({
  error: 'Database connection unavailable. Please try again later.'
});

}
}