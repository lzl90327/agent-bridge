// Artifact API 路由
import { Router } from 'express';
import { getDB } from '../db';
import { asyncHandler, NotFoundError, ValidationError } from '../middleware/error';
import { validate, createArtifactSchema } from '../validators';

const router = Router();
const db = getDB();

// POST /api/v1/artifacts - 创建产物
router.post('/',
  validate(createArtifactSchema),
  asyncHandler(async (req, res) => {
    const data = req.validatedBody;

    // 验证 run 和 session 存在
    const run = await db.getRun(data.run_id);
    if (!run) {
      throw new ValidationError(`Run ${data.run_id} not found`);
    }

    const session = await db.getSession(data.session_id);
    if (!session) {
      throw new ValidationError(`Session ${data.session_id} not found`);
    }

    const artifact = await db.createArtifact({
      run_id: data.run_id,
      session_id: data.session_id,
      owner_app_id: data.owner_app_id || session.app_id,
      owner_user_id: data.owner_user_id || session.user_id,
      artifact_kind: data.artifact_kind,
      source_type: data.source_type,
      source_ref: data.source_ref,
      visibility: data.visibility,
      content: data.content,
      metadata: data.metadata,
      updated_at: new Date()
    });

    res.status(201).json({
      success: true,
      data: artifact
    });
  })
);

// GET /api/v1/artifacts/:id - 获取产物
router.get('/:id',
  asyncHandler(async (req, res) => {
    const artifact = await db.getArtifact(req.params.id);
    if (!artifact) {
      throw new NotFoundError('Artifact', req.params.id);
    }

    res.json({
      success: true,
      data: artifact
    });
  })
);

// GET /api/v1/artifacts/:id/content - 获取产物内容
router.get('/:id/content',
  asyncHandler(async (req, res) => {
    const artifact = await db.getArtifact(req.params.id);
    if (!artifact) {
      throw new NotFoundError('Artifact', req.params.id);
    }

    // 根据 mime_type 设置响应头
    const mimeType = artifact.metadata?.mime_type || 'text/plain';
    res.setHeader('Content-Type', mimeType);

    // 如果是文本类型，直接返回
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      return res.send(artifact.content);
    }

    // 否则返回 JSON 包装
    res.json({
      success: true,
      data: {
        content: artifact.content,
        mime_type: mimeType,
        size_bytes: artifact.metadata?.size_bytes
      }
    });
  })
);

// GET /api/v1/artifacts - 列产物
router.get('/',
  asyncHandler(async (req, res) => {
    const { run_id, session_id, artifact_kind, visibility, limit = '20', offset = '0' } = req.query;

    let artifacts = await db.listArtifacts(
      run_id as string | undefined,
      session_id as string | undefined
    );

    // 过滤类型
    if (artifact_kind) {
      artifacts = artifacts.filter(a => a.artifact_kind === artifact_kind);
    }

    // 过滤可见性
    if (visibility) {
      artifacts = artifacts.filter(a => a.visibility === visibility);
    }

    // 分页
    const total = artifacts.length;
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    artifacts = artifacts.slice(offsetNum, offsetNum + limitNum);

    res.json({
      success: true,
      data: artifacts,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + artifacts.length < total
      }
    });
  })
);

// PATCH /api/v1/artifacts/:id - 更新产物
router.patch('/:id',
  asyncHandler(async (req, res) => {
    const artifact = await db.getArtifact(req.params.id);
    if (!artifact) {
      throw new NotFoundError('Artifact', req.params.id);
    }

    const updates: any = { updated_at: new Date() };

    if (req.body.content) {
      updates.content = req.body.content;
      // 更新版本号
      updates.metadata = {
        ...artifact.metadata,
        version: (artifact.metadata?.version || 1) + 1
      };
    }

    if (req.body.visibility) {
      updates.visibility = req.body.visibility;
    }

    const updated = await db.updateArtifact?.(req.params.id, updates) ||
                    { ...artifact, ...updates };

    res.json({
      success: true,
      data: updated
    });
  })
);

// DELETE /api/v1/artifacts/:id - 删除产物
router.delete('/:id',
  asyncHandler(async (req, res) => {
    const artifact = await db.getArtifact(req.params.id);
    if (!artifact) {
      throw new NotFoundError('Artifact', req.params.id);
    }

    // 软删除
    const updated = await db.updateArtifact?.(req.params.id, {
      visibility: 'private',
      updated_at: new Date()
    }) || { ...artifact, visibility: 'private', updated_at: new Date() };

    res.json({
      success: true,
      data: updated
    });
  })
);

export default router;