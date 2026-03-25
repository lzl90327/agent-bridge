// 请求验证
import { z } from 'zod';

// Session 验证
export const createSessionSchema = z.object({
  app_id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  context: z.record(z.any()).optional()
});

export const updateSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  context: z.record(z.any()).optional(),
  status: z.enum(['active', 'archived', 'closed']).optional()
});

// Run 验证
export const createRunSchema = z.object({
  session_id: z.string().uuid(),
  skill_id: z.string(),
  skill_type: z.enum(['native_skill', 'delegated_skill']),
  input: z.record(z.any()),
  metadata: z.record(z.any()).optional()
});

export const submitInputSchema = z.object({
  input: z.record(z.any()),
  run_id: z.string().uuid()
});

// Artifact 验证
export const createArtifactSchema = z.object({
  run_id: z.string().uuid(),
  session_id: z.string().uuid(),
  artifact_kind: z.enum(['brief', 'outline', 'draft', 'final', 'asset', 'log']),
  source_type: z.enum(['skill', 'tool', 'user', 'system']),
  source_ref: z.string(),
  visibility: z.enum(['private', 'session', 'app', 'public']),
  content: z.string(),
  metadata: z.object({
    mime_type: z.string(),
    size_bytes: z.number(),
    version: z.number().default(1)
  })
});

// Memory 验证
export const createMemorySchema = z.object({
  owner_type: z.enum(['app', 'user', 'session']),
  owner_id: z.string().uuid(),
  memory_type: z.enum(['long_term', 'working', 'contextual']),
  key: z.string(),
  value: z.any(),
  scope: z.array(z.string()).default([]),
  importance: z.number().min(1).max(10).default(5),
  metadata: z.record(z.any()).optional(),
  expires_at: z.string().datetime().optional()
});

export const queryMemorySchema = z.object({
  owner_type: z.enum(['app', 'user', 'session']),
  owner_id: z.string().uuid(),
  memory_type: z.enum(['long_term', 'working', 'contextual']).optional(),
  limit: z.number().min(1).max(100).default(10)
});

// 通用验证中间件
export function validate(schema: z.ZodSchema) {
  return (req: any, res: any, next: any) => {
    try {
      const result = schema.parse(req.body);
      req.validatedBody = result;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message
            }))
          }
        });
      }
      next(error);
    }
  };
}