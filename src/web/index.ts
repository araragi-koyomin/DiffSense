import express from 'express';
import * as fs from 'fs'; import * as path from 'path';

export async function startWebServer(port: number): Promise<void> {
  const app = express();
  app.use(express.json());
  const layoutPath = path.join(__dirname, 'views', 'layout.html');
  const layout = fs.readFileSync(layoutPath, 'utf-8');

  app.get('/', (_req, res) => {
    res.send(layout.replace('{{{content}}}', '<p style="text-align:center;padding:2rem;color:var(--accents-5);">DiffSense Web 界面</p>'));
  });

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
