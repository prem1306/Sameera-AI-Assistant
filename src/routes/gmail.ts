import type { TaskRunner } from '../services/agent/TaskRunner.ts';
import { Router } from 'express';
import type { GmailBridge } from '../services/GmailBridge.ts';

type MailBridge = Pick<GmailBridge, 'token' | 'status' | 'prepare' | 'requestApproval' | 'approve' | 'cancelApproval'>;

/** Human approval stays separate from model-visible draft/approval-request tools. */
export function gmailRoutes(bridge: MailBridge, token: string, pairing: { extensionPath: string; serverUrl: string }, tasks?: TaskRunner) {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers['x-sameera-token'] !== token) return res.status(403).json({ success: false, error: 'Local session expired. Refresh Sameera.' });
    next();
  });
  router.get('/state', (_req, res) => res.json(bridge.status()));
  router.get('/pair', (_req, res) => res.json({ token: bridge.token, ...pairing }));
  router.post('/draft', async (req, res) => {
    if (typeof req.body?.id !== 'string') return res.status(400).json({ success: false, error: 'Missing call ID.' });
    if (tasks) {
      try { const task = await tasks.create([{ capability: 'gmail', action: 'draft', args: { mail: req.body.mail } }]); return res.json({ success: false, taskId: task.id, requiresUserApproval: true, needsClarification: true, question: 'Review the exact Gmail draft and its destination in Agent activity before creating the cloud draft.' }); }
      catch { return res.status(400).json({ success: false, error: 'Invalid draft request.' }); }
    }
    res.json(await bridge.prepare(req.body.id, req.body.mail));
  });
  router.post('/request-send', (_req, res) => res.json(bridge.requestApproval()));
  router.post('/approve', async (req, res) => res.json(await bridge.approve(req.body?.id)));
  router.post('/cancel', (req, res) => res.json(bridge.cancelApproval(req.body?.id)));
  return router;
}

/** The browser pairing token cannot authorize mail approval or Windows actions. */
export function gmailBrowserRoutes(bridge: Pick<GmailBridge, 'token' | 'next' | 'finish'>) {
  const router = Router();
  router.post('/next', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers['x-sameera-browser-token'] !== bridge.token) return res.sendStatus(403);
    res.json({ job: bridge.next() });
  });
  router.post('/result', (req, res) => {
    if (req.headers['x-sameera-browser-token'] !== bridge.token) return res.sendStatus(403);
    res.json({ success: bridge.finish(req.body?.id, req.body?.result) });
  });
  return router;
}
