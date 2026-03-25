import { Router } from 'express';
import { Pool } from 'pg';
import { RunManager } from '../services/RunManager';
import { v4 as uuidv4 } from 'uuid';

export function createRestAPI(db: Pool): Router {
  const router = Router();
  const runManager = new RunManager(db);

  // ===== Session API =====
  
  // 创建会话
  router.post('/sessions', async (req, res) => {
    try {
      const { app_key, user_id, topic, metadata } = req.body;
      
      // TODO: 验证 app_key
      // TODO: 获取或创建 user
      
      const session = {
        id: uuidv4(),
        app_id: 'app-id', // TODO: 从 app_key 获取
        user_id: user_id || uuidv4(),
        title: topic,
        status: 'active',
        context: { topic, variables: metadata || {} },
        created_at: new Date(),
        updated_at: new Date(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      await db.query(
        `INSERT INTO sessions (id, app_id, user_id, title, status, context, created_at, updated_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [session.id, session.app_id, session.user_id, session.title, session.status,
         JSON.stringify(session.context), session.created_at, session.updated_at, session.expires_at]
      );

      res.json({
        id: session.id,
        user_id: session.user_id,
        status: session.status,
        created_at: session.created_at
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  // 获取会话
  router.get('/sessions/:id', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM sessions WHERE id = $1', [req.params.id]);
      if (!result.rows[0]) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get session' });
    }
  });

  // ===== Run API =====

  // 创建运行
  router.post('/runs', async (req, res) => {
    try {
      const { session_id, skill_id, input } = req.body;
      
      // 获取 skill 信息
      const skillResult = await db.query('SELECT * FROM skills WHERE id = $1', [skill_id]);
      if (!skillResult.rows[0]) {
        return res.status(404).json({ error: 'Skill not found' });
      }
      const skill = skillResult.rows[0];

      // 创建 run
      const run = await runManager.createRun({
        session_id,
        skill_id,
        skill_type: skill.skill_type,
        input
      });

      res.json(run);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create run' });
    }
  });

  // 获取运行状态
  router.get('/runs/:id', async (req, res) => {
    try {
      const run = await runManager.getRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }
      res.json(run);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get run' });
    }
  });

  // 取消运行
  router.post('/runs/:id/cancel', async (req, res) => {
    try {
      const run = await runManager.getRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      if (!runManager.canTransition(run.status, 'cancelled')) {
        return res.status(400).json({ error: `Cannot cancel run in ${run.status} status` });
      }

      await runManager.updateStatus(req.params.id, 'cancelled');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to cancel run' });
    }
  });

  // 提交用户输入
  router.post('/runs/:id/input', async (req, res) => {
    try {
      const { input } = req.body;
      const run = await runManager.getRun(req.params.id);
      
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      if (run.status !== 'waiting_user_input') {
        return res.status(400).json({ error: 'Run is not waiting for input' });
      }

      // 记录用户输入事件
      await runManager.logEvent(
        run.id,
        run.session_id,
        'run.user_input_received',
        { input },
        'user'
      );

      // 更新状态为 running
      await runManager.updateStatus(run.id, 'running', {
        waiting_input: null
      });

      res.json(await runManager.getRun(run.id));
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit input' });
    }
  });

  // ===== Artifact API =====

  // 获取会话产物列表
  router.get('/sessions/:id/artifacts', async (req, res) => {
    try {
      const { kind, page = 1, limit = 20 } = req.query;
      
      let query = 'SELECT * FROM artifacts WHERE session_id = $1';
      const params: any[] = [req.params.id];
      
      if (kind) {
        query += ' AND artifact_kind = $2';
        params.push(kind);
      }
      
      query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, (Number(page) - 1) * Number(limit));

      const result = await db.query(query, params);
      res.json({ items: result.rows, total: result.rowCount });
    } catch (error) {
      res.status(500).json({ error: 'Failed to list artifacts' });
    }
  });

  // ===== Memory API =====

  // 查询记忆
  router.get('/memories', async (req, res) => {
    try {
      const { owner_type, owner_id, key, prefix } = req.query;
      
      let query = 'SELECT * FROM memories WHERE owner_type = $1 AND owner_id = $2';
      const params = [owner_type, owner_id];
      
      if (key) {
        query += ' AND key = $3';
        params.push(key as string);
      } else if (prefix) {
        query += ' AND key LIKE $3';
        params.push(`${prefix}%`);
      }

      const result = await db.query(query, params);
      res.json({ items: result.rows });
    } catch (error) {
      res.status(500).json({ error: 'Failed to query memories' });
    }
  });

  // 写入记忆
  router.post('/memories', async (req, res) => {
    try {
      const { owner_type, owner_id, memory_type, key, value, scope, expires_at } = req.body;
      
      const memory = {
        id: uuidv4(),
        owner_type,
        owner_id,
        memory_type,
        key,
        value,
        scope: scope || ['*'],
        metadata: { importance: 0.5, access_count: 0, last_accessed_at: new Date() },
        expires_at: expires_at ? new Date(expires_at) : null,
        created_at: new Date(),
        updated_at: new Date()
      };

      await db.query(
        `INSERT INTO memories (id, owner_type, owner_id, memory_type, key, value, scope, metadata, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (owner_type, owner_id, key) 
         DO UPDATE SET value = $6, updated_at = $11`,
        [memory.id, memory.owner_type, memory.owner_id, memory.memory_type, memory.key,
         JSON.stringify(memory.value), memory.scope, JSON.stringify(memory.metadata),
         memory.expires_at, memory.created_at, memory.updated_at]
      );

      res.json(memory);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create memory' });
    }
  });

  return router;
}
