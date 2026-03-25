// Native Skill Handlers 注册表
import { logger } from '../../utils/logger';

// Handler 上下文
export interface HandlerContext {
  runId: string;
  sessionId: string;
  skillId: string;
  userId?: string;
  appId?: string;
  memory: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
  artifact: {
    create: (data: any) => Promise<any>;
    get: (id: string) => Promise<any>;
  };
}

// Handler 函数类型
export type SkillHandler = (
  input: Record<string, any>,
  context: HandlerContext
) => Promise<Record<string, any>>;

// Handler 注册表
class HandlerRegistry {
  private handlers: Map<string, SkillHandler> = new Map();

  register(ref: string, handler: SkillHandler): void {
    this.handlers.set(ref, handler);
    logger.info({ ref }, 'Skill handler registered');
  }

  get(ref: string): SkillHandler | undefined {
    return this.handlers.get(ref);
  }

  has(ref: string): boolean {
    return this.handlers.has(ref);
  }

  list(): string[] {
    return Array.from(this.handlers.keys());
  }
}

export const handlerRegistry = new HandlerRegistry();

// 内置 Handlers
export async function materialOrganizer(
  input: { urls?: string[]; query?: string },
  context: HandlerContext
): Promise<any> {
  logger.info({ input, runId: context.runId }, 'Material organizer started');

  const results = {
    sources: input.urls || [],
    query: input.query,
    organized_at: new Date().toISOString(),
    summary: '素材整理完成'
  };

  const artifact = await context.artifact.create({
    kind: 'material_card',
    content: JSON.stringify(results),
    metadata: { source_count: input.urls?.length || 0 }
  });

  return {
    success: true,
    artifact_id: artifact.id,
    summary: results.summary
  };
}

handlerRegistry.register('handlers.materialOrganizer', materialOrganizer);