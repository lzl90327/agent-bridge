// Memory API 路由
import { Router } from 'express';
import { getDB } from '../db';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error';
import { validate, createMemorySchema, queryMemorySchema } from '../validators';

const router = Router();
const db = getDB();

// POST /api/v1/memories - 写入记忆
router.post('/',
  validate(createMemorySchema),
  asyncHandler(async (req, res) => {
    const data = req.validatedBody;

    // 验证 owner 存在
    let ownerExists = false;
    if (data.owner_type === 'app') {
      ownerExists = !!(await db.getApp(data.owner_id));
    } else if (data.owner_type === 'user') {
      ownerExists = !!(await db.getUser(data.owner_id));
    } else if (data.owner_type === 'session') {
      ownerExists = !!(await db.getSession(data.owner_id));
    }

    if (!ownerExists) {
      throw new ValidationError(`${data.owner_type} ${data.owner_id} not found`);
    }

    const memory = await db.createMemory({
      owner_type: data.owner_type,
      owner_id: data.owner_id,
      memory_type: data.memory_type,
      key: data.key,
      value: data.value,
      scope: data.scope,
      metadata: {
        importance: data.importance,
        access_count: 0,
        last_accessed_at: new Date()
      },
      expires_at: data.expires_at ? new Date(data.expires_at) : undefined,
      updated_at: new Date()
    });

    res.status(201).json({
      success: true,
      data: memory
    });
  })
);

// GET /api/v1/memories - 查询记忆
router.get('/',
  asyncHandler(async (req, res) => {
    const { owner_type, owner_id, memory_type, limit = '10' } = req.query;

    if (!owner_type || !owner_id) {
      throw new ValidationError('owner_type and owner_id are required');
    }

    let memories = await db.queryMemories(
      owner_type as string,
      owner_id as string,
      parseInt(limit as string)
    );

    // 过滤类型
    if (memory_type) {
      memories = memories.filter(m => m.memory_type === memory_type);
    }

    res.json({
      success: true,
      data: memories
    });
  })
);

// GET /api/v1/memories/:id - 获取记忆
router.get('/:id',
  asyncHandler(async (req, res) => {
    const memory = await db.getMemory?.(req.params.id);
    if (!memory) {
      throw new NotFoundError('Memory', req.params.id);
    }

    res.json({
      success: true,
      data: memory
    });
  })
);

// DELETE /api/v1/memories/:id - 删除记忆
router.delete('/:id',
  asyncHandler(async (req, res) => {
    const memory = await db.getMemory?.(req.params.id);
    if (!memory) {
      throw new NotFoundError('Memory', req.params.id);
    }

    // 软删除 - 标记为已过期
    await db.updateMemory?.(req.params.id, {
      expires_at: new Date()
    });

    res.json({
      success: true,
      message: 'Memory deleted'
    });
  })
);

export default router;