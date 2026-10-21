import { Router } from 'express';
import type { SystemActions } from '../services/SystemActions.ts';
import type { TaskRunner } from '../services/agent/TaskRunner.ts';

/** Runtime and origin checks are applied by the server before this router. */
export function systemRoutes(actions: Pick<SystemActions, 'execute'>, token: string, tasks?: TaskRunner) {
  const router = Router();
  router.all('/session', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(403).json({ error: 'Desktop sessions are available only through the trusted launcher.' });
  });
  router.post('/action', async (req, res) => {
    if (req.headers['x-sameera-token'] !== token) return res.status(403).json({ success: false, error: 'Local action session expired.' });
    const { id, action, args } = req.body || {};
    if (typeof id !== 'string' || id.length > 100 || typeof action !== 'string' || !args || typeof args !== 'object') return res.status(400).json({ success: false, error: 'Invalid local action request.' });
    if (tasks) {
      try {
        const task = await tasks.create([{ capability: 'system', action, args }]);
        return res.json({ success: false, taskId: task.id, requiresUserApproval: true, needsClarification: true, question: 'Review the requested scope in Agent activity. Nothing has executed.' });
      } catch { return res.status(400).json({ success: false, error: 'Invalid or unsupported Windows task.' }); }
    }
    res.json(await actions.execute(id, action, args));
  });
  return router;
}
