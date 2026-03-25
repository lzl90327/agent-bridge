// Run API 路由
import { Router } from 'express';
import { getDB } from '../db';
import { RunManager } from '../services/RunManager';
import { asyncHandler, NotFoundError, ValidationError, ConflictError } from '../middleware/error';
import { validate, createRunSchema, submitInputSchema } from '../validators';

const router = Router();
const db = getDB();
const runManager = new RunManager(db);

// POST /api/v1/runs - 创建运行
router.post('/',
  validate(createRunSchema),
  asyncHandler(async (req, res) => {
    const data = req.validatedBody;

    // 验证 session 存在
    const session = await db.getSession(data.session_id);
    if (!session) {
      throw new ValidationError(`Session ${data.session_id} not found`);
    }

    // 验证 skill 存在
    const skill = await db.getSkill(data.skill_id);
    if (!skill) {
      throw new ValidationError(`Skill ${data.skill_id} not found`);
    }

    // 创建 run
    const run = await runManager.createRun({
      session_id: data.session_id,
      skill_id: data.skill_id,
      skill_type: data.skill_type,
      input: data.input
    });

    // 记录事件
    await runManager.logEvent(run.id, run.session_id, 'run.created', {
      skill_id: data.skill_id,
      skill_type: data.skill_type
    }, 'platform');

    res.status(201).json({
      success: true,
      data: run
    });
  })
);

// GET /api/v1/runs/:id - 获取运行
router.get('/:id',
  asyncHandler(async (req, res) => {
    const run = await runManager.getRun(req.params.id);
    if (!run) {
      throw new NotFoundError('Run', req.params.id);
    }

    // 获取关联数据
    const events = await db.getEvents(run.id);
    const latestSnapshot = await runManager.getLatestSnapshot(run.id);

    res.json({
      success: true,
      data: {
        ...run,
        events: events.slice(-10), // 最近 10 条事件
        latest_snapshot: latestSnapshot
      }
    });
  })
);

// GET /api/v1/runs - 列运行
router.get('/',
  asyncHandler(async (req, res) => {
    const { session_id, status, limit = '20', offset = '0' } = req.query;

    if (!session_id) {
      throw new ValidationError('session_id is required');
    }

    let runs = await db.listRuns(session_id as string);

    // 过滤状态
    if (status) {
      runs = runs.filter(r => r.status === status);
    }

    // 分页
    const total = runs.length;
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    runs = runs.slice(offsetNum, offsetNum + limitNum);

    res.json({
      success: true,
      data: runs,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + runs.length < total
      }
    });
  })
);

// POST /api/v1/runs/:id/cancel - 取消运行
router.post('/:id/cancel',
  asyncHandler(async (req, res) => {
    const run = await runManager.getRun(req.params.id);
    if (!run) {
      throw new NotFoundError('Run', req.params.id);
    }

    // 检查是否可以取消
    const terminalStatuses = ['completed', 'failed', 'timed_out', 'cancelled'];
    if (terminalStatuses.includes(run.status)) {
      throw new ConflictError(`Run is already ${run.status}`);
    }

    // 更新状态为 cancelled
    await runManager.updateStatus(run.id, 'cancelled', {
      error: { code: 'CANCELLED', message: 'Run cancelled by user' }
    });

    // 记录事件
    await runManager.logEvent(run.id, run.session_id, 'run.cancelled', {
      reason: 'user_request'
    }, 'user');

    const updated = await runManager.getRun(req.params.id);

    res.json({
      success: true,
      data: updated
    });
  })
);

// POST /api/v1/runs/:id/input - 提交用户输入
router.post('/:id/input',
  validate(submitInputSchema),
  asyncHandler(async (req, res) => {
    const run = await runManager.getRun(req.params.id);
    if (!run) {
      throw new NotFoundError('Run', req.params.id);
    }

    // 检查是否在等待输入状态
    if (run.status !== 'waiting_user_input') {
      throw new ConflictError(`Run is not waiting for input (current status: ${run.status})`);
    }

    const data = req.validatedBody;

    // 记录用户输入事件
    await runManager.logEvent(run.id, run.session_id, 'user.input_received', {
      input: data.input
    }, 'user');

    // 更新状态为 running
    await runManager.updateStatus(run.id, 'running', {
      waiting_input: undefined
    });

    // 记录恢复事件
    await runManager.logEvent(run.id, run.session_id, 'run.resumed', {
      source: 'user_input'
    }, 'platform');

    const updated = await runManager.getRun(req.params.id);

    res.json({
      success: true,
      data: updated
    });
  })
);

// GET /api/v1/runs/:id/events - 获取运行事件
router.get('/:id/events',
  asyncHandler(async (req, res) => {
    const run = await runManager.getRun(req.params.id);
    if (!run) {
      throw new NotFoundError('Run', req.params.id);
    }

    const { after_sequence } = req.query;
    const events = await db.getEvents(
      run.id,
      after_sequence ? parseInt(after_sequence as string) : undefined
    );

    res.json({
      success: true,
      data: events
    });
  })
);

// GET /api/v1/runs/:id/snapshots - 获取运行快照
router.get('/:id/snapshots',
  asyncHandler(async (req, res) => {
    const run = await runManager.getRun(req.params.id);
    if (!run) {
      throw new NotFoundError('Run', req.params.id);
    }

    const snapshot = await runManager.getLatestSnapshot(run.id);

    res.json({
      success: true,
      data: snapshot
    });
  })
);

export default router;