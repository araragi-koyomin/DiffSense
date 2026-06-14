import express from 'express';
import * as fs from 'fs'; import * as path from 'path';
import { registerPageRoutes } from './routes/pages';
import { registerApiRoutes } from './routes/api';

export async function startWebServer(port: number, repoPath?: string): Promise<void> {
  const app = express();
  app.use(express.json());

  registerApiRoutes(app, repoPath);
  registerPageRoutes(app, repoPath);

  let cp = port;
  for (let i = 0; i < 3; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        app.listen(cp, '127.0.0.1', () => { console.log('DiffSense Web 界面已启动: http://localhost:' + cp); resolve(); })
          .on('error', (e: any) => { if (e.code === 'EADDRINUSE') reject(new Error('EADDRINUSE')); else reject(e); });
      });
      return;
    } catch (e: any) {
      if (e.message === 'EADDRINUSE' && i < 2) { cp++; console.log('端口被占用，尝试端口 ' + cp + '...'); }
      else throw e;
    }
  }
}
