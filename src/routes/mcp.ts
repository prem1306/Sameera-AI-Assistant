import { Router } from 'express';
import type { McpService } from '../services/mcp/McpService.ts';

export function mcpRoutes(service: () => McpService | null, token: string) {
  const router = Router();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!service()) return res.status(403).json({ error: 'Connections are available in the desktop app only.' });
    if (req.headers['x-sameera-token'] !== token) return res.status(403).json({ error: 'Session expired. Refresh Sameera.' });
    next();
  });
  router.get('/state', (_req, res) => res.json(service()!.state()));
  router.get('/catalog', (_req, res) => res.json({ success: true, connections: service()!.catalog() }));
  router.post('/action', async (req, res) => {
    try {
      if (typeof req.body?.operation !== 'string' || !req.body?.args || typeof req.body.args !== 'object') throw new Error('Invalid connection request.');
      res.json(await service()!.action(req.body.operation, req.body.args));
    } catch (error) { res.status(400).json({ success: false, error: (error as Error).message }); }
  });
  return router;
}
