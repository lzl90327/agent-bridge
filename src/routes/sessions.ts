// Session API 路由
import { Router } from 'express';
import { getDB } from '../db';
import { RunManager } from '../services/RunManager';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error';
import { validate, createSessionSchema, updateSessionSchema } from '../validators';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const db = getDB();
const runManager = new RunManager(db);

// POST /api/v1/sessions - 创建会话
router.post('/',
  validate(createSessionSchema),
  asyncHandler(async (req, res) => {
    const data = req.validatedBody;

    // 验证 app 和 user 存在
    const app = await db.getApp(data.app_id);
    if (!app) {
      throw new ValidationError(`App ${data.app_id} not found`);
    }

    const user = await db.getUser(data.user_id);
    if (!user) {
      throw new ValidationError(`User ${data.user_id} not found`);
    }

    const session = await db.createSession({
      app_id: data.app_id,
      user_id: data.user_id,
      title: data.title,
      context: {
        topic: data.title,
        variables: data.context || {}
      },
      status: 'active',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
      updated_at: new Date()
    });

    res.status(201).json({
      success: true,
      data: session
    });
  })
);

// GET /api/v1/sessions/:id - 获取会话
router.get('/:id',
  asyncHandler(async (req, res) => {
    const session = await db.getSession(req.params.id);
    if (!session) {
      throw new NotFoundError('Session', req.params.id);
    }

    res.json({
      success: true,
      data: session
    });
  })
);

// GET /api/v1/sessions - 列会话
router.get('/',
  asyncHandler(async (req, res) => {
    const { app_id, user_id, status, limit = '20', offset = '0' } = req.query;

    if (!app_id) {
      throw new ValidationError('app_id is required');
    }

    let sessions = await db.listSessions(app_id as string, user_id as string);

    // 过滤状态
    if (status) {
      sessions = sessions.filter(s => s.status === status);
    }

    // 分页
    const total = sessions.length;
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    sessions = sessions.slice(offsetNum, offsetNum + limitNum);

    res.json({
      success: true,
      data: sessions,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + sessions.length < total
      }
    });
  })
);

// PATCH /api/v1/sessions/:id - 更新会话
router.patch('/:id',
  validate(updateSessionSchema),
  asyncHandler(async (req, res) => {
    const session = await db.getSession(req.params.id);
    if (!session) {
      throw new NotFoundError('Session', req.params.id);
    }

    const data = req.validatedBody;
    const updates: any = { updated_at: new Date() };

    if (data.title) updates.title = data.title;
    if (data.context) updates.context = { ...session.context, ...data.context };
    if (data.status) updates.status = data.status;

    // 使用内存数据库的通用更新方法
    const updated = await db.updateSession?.(req.params.id, updates) ||
                    { ...session, ...updates };

    res.json({
      success: true,
      data: updated
    });
  })
);

// DELETE /api/v1/sessions/:id - 删除会话
router.delete('/:id',
  asyncHandler(async (req, res) => {
    const session = await db.getSession(req.params.id);
    if (!session) {
      throw new NotFoundError('Session', req.params.id);
    }

    // 软删除 - 更新状态为 expired
    const updated = await db.updateSession?.(req.params.id, {
      status: 'expired',
      updated_at: new Date()
    }) || { ...session, status: 'expired', updated_at: new Date() };

    res.json({
      success: true,
      data: updated
    });
  })
);

// GET /api/v1/sessions/:id/runs - 获取会话的运行列表
router.get('/:id/runs',
  asyncHandler(async (req, res) => {
    const session = await db.getSession(req.params.id);
    if (!session) {
      throw new NotFoundError('Session', req.params.id);
    }

    const runs = await db.listRuns(req.params.id);

    res.json({
      success: true,
      data: runs
    });
  })
);

export default router;