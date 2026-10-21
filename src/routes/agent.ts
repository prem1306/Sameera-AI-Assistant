import { Router } from 'express';
import type { AgentService } from '../services/agent/AgentService.ts';
import type { LocalDatabase } from '../services/database/LocalDatabase.ts';
import type { MemoryStore } from '../services/privacy/MemoryStore.ts';

export function agentRoutes(agent: AgentService, token: string, database: () => LocalDatabase | null, memory: () => MemoryStore | null) {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.headers['x-sameera-token'] !== token) return res.status(403).json({ success: false, error: 'Session expired.' });
    next();
  });
  router.get('/state', (_req, res) => res.json({ ...agent.state(), memoryEnabled: database()?.settings.get('memoryEnabled') || false, previousTasks: database()?.tasks.list() || [] }));
  router.post('/preferences', (req, res) => {
    try {
      const { mode, persona, providerPaid, memoryEnabled } = req.body || {};
      if (typeof memoryEnabled !== 'boolean') throw new Error('Choose whether to save memories.');
      agent.privacy.configure(mode, persona, providerPaid);
      const settings = database()?.settings;
      settings?.set('privacyMode', mode); settings?.set('persona', persona); settings?.set('providerPaid', providerPaid); settings?.set('memoryEnabled', memoryEnabled);
      res.json({ success: true });
    } catch { res.status(400).json({ success: false, error: 'Invalid preferences or unavailable local storage.' }); }
  });
  router.post('/tasks', async (req, res) => {
    try { res.json(await agent.tasks.create(req.body?.steps)); }
    catch (error) { res.status(400).json({ success: false, error: (error as Error).message }); }
  });
  router.post('/tasks/:id/:operation', (req, res) => {
    try {
      const id = String(req.params.id);
      if (req.params.operation === 'cancel') agent.tasks.cancel(id);
      else if (req.params.operation === 'approve') {
        // Respond immediately; the activity panel observes progress while native actions run.
        void agent.tasks.approve(id).catch(() => {});
      } else throw new Error('Unsupported task operation.');
      res.json({ success: true });
    } catch (error) { res.status(400).json({ success: false, error: (error as Error).message }); }
  });
  router.post('/disclosures', (req, res) => {
    try {
      const task = agent.tasks.get(req.body?.taskId);
      if (!task.results.length || task.state === 'cancelled') throw new Error('No task result is available.');
      res.json(agent.privacy.protect(task.results, `Task ${task.id}`));
    } catch { res.status(400).json({ success: false, error: 'Task result unavailable.' }); }
  });
  router.post('/disclosures/:id/:operation', (req, res) => {
    try {
      if (req.params.operation === 'approve') agent.privacy.approve(String(req.params.id));
      else if (req.params.operation === 'cancel') agent.privacy.cancel(String(req.params.id));
      else throw new Error('Unsupported disclosure operation.');
      res.json({ success: true });
    } catch (error) { res.status(400).json({ success: false, error: (error as Error).message }); }
  });
  router.get('/memories', async (_req, res) => {
    try { res.json({ memories: await memory()?.list() || [] }); }
    catch { res.status(503).json({ success: false, error: 'Encrypted memory storage is unavailable.' }); }
  });
  router.put('/memories', async (req, res) => {
    try {
      if (!database()?.settings.get('memoryEnabled') && req.body?.memories?.length) throw new Error('Enable local memory first.');
      const store = memory(); if (!store) throw new Error('Memory requires the Windows desktop app.');
      await store.replace(req.body?.memories); res.json({ success: true });
    } catch (error) { res.status(400).json({ success: false, error: (error as Error).message }); }
  });
  router.post('/memory-disclosure', async (_req, res) => {
    try { res.json(agent.privacy.protect((await memory()?.list() || []).slice(0, 5), 'Recent local memories')); }
    catch { res.status(503).json({ success: false, error: 'Memory unavailable.' }); }
  });
  return router;
}
