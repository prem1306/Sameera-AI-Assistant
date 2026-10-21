import type { DatabaseSync } from 'node:sqlite';
import type { Task } from '../agent/TaskRunner.ts';
export class TaskRepository {
  constructor(private database: DatabaseSync) {
    database.exec("UPDATE agent_tasks SET state='uncertain' WHERE state IN ('planning','running','waiting-approval')");
  }
  record(task: Task) {
    this.database.prepare('INSERT INTO agent_tasks(id,state,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated_at=excluded.updated_at').run(task.id, task.state, new Date().toISOString());
    this.database.exec('DELETE FROM agent_tasks WHERE id NOT IN (SELECT id FROM agent_tasks ORDER BY updated_at DESC LIMIT 100)');
  }
  list() { return this.database.prepare('SELECT id,state,updated_at FROM agent_tasks ORDER BY updated_at DESC').all(); }
}
