import express from 'express';

export async function startWebServer(port: number): Promise<void> {
  const app = express();
  app.get('/', (_req, res) => res.send('DiffSense Web (T15 pending)'));
  app.listen(port, '127.0.0.1', () => console.log(`DiffSense Web: http://localhost:${port}`));
}
