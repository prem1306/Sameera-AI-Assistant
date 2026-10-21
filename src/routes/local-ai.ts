import { Router } from 'express';
import type { LocalRuntime } from '../services/local/Runtime.ts';
import type { AgentService } from '../services/agent/AgentService.ts';
import { validLanguage } from '../services/session/Preferences.ts';

export function localAiRoutes(runtime: () => LocalRuntime | null, agent: AgentService, token: string) {
  const router = Router();
  router.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); if (req.headers['x-sameera-token'] !== token) return res.sendStatus(403); next(); });
  router.get('/status', async (_req, res) => res.json(await runtime()?.status() || { ready: false, state: 'unavailable' }));
  router.post('/install', async (req, res) => {
    const local = runtime(); if (!local) return res.sendStatus(503);
    const token = req.body?.token || ''; if (typeof token !== 'string' || token.length > 220 || (token && !/^hf_[A-Za-z0-9]{10,200}$/.test(token))) return res.sendStatus(400);
    if ((await local.status()).state === 'installing') return res.status(429).json({ error: 'Installation is already running.' });
    void local.installer.install(token).catch(() => {}); res.json({ success: true });
  });
  router.post('/cancel', (_req, res) => { runtime()?.installer.cancel(); runtime()?.stop(); res.json({ success: true }); });
  router.post('/text', async (req, res) => {
    try {
      if (agent.privacy.mode !== 'local-only') throw new Error('Choose Local-only AI for local text requests.');
      const local = runtime(); if (!local || typeof req.body?.text !== 'string') throw new Error('Local processing unavailable.');
      const language = validLanguage(req.body.language) ? req.body.language : 'english';
      const result = await local.exclusive(signal => local.reason(req.body.text, language, agent.privacy.persona, signal));
      const task = result.steps.length ? await agent.tasks.create(result.steps) : undefined;
      res.json({ success: true, reply: task ? 'Review the task in Agent activity before it runs.' : result.reply, taskId: task?.id });
    } catch (error) { res.status(400).json({ success: false, error: (error as Error).message }); }
  });
  router.post('/read-result', async (req, res) => {
    try {
      const task = agent.tasks.get(String(req.body?.taskId));
      const result = task.results[Number(req.body?.index)];
      const text = result?.text || result?.content;
      const offset = Number(req.body?.offset || 0);
      if (typeof text !== 'string' || !Number.isSafeInteger(offset) || offset < 0 || offset >= text.length) throw new Error('No readable text at this position.');
      const local = runtime(); if (!local) throw new Error('Local speech is unavailable.');
      const language = validLanguage(req.body.language) ? req.body.language : 'english';
      const chunk = text.slice(offset, offset + 1200);
      const speech = await local.exclusive(signal => local.speak(chunk, language, agent.privacy.persona, signal));
      res.json({ success: true, ...speech, nextOffset: offset + chunk.length < text.length ? offset + chunk.length : null });
    } catch (error) { res.status(400).json({ success: false, error: (error as Error).message }); }
  });
  return router;
}
