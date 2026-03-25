// Skill Orchestrator - 管理 Skill 执行流程
import { Skill, Run, RunStatus, Session } from '../types';
import { RunManager } from './RunManager';
import { OpenClawAdapter } from '../adapters/OpenClawAdapter';
import { getDB } from '../db';
import { logger } from '../utils/logger';

export interface ExecutionContext {
  runId: string;
  sessionId: string;
  skillId: string;
  input: Record<string, any>;
  metadata: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  output?: Record<string, any>;
  error?: { code: string; message: string };
  artifacts?: string[];
}

export class SkillOrchestrator {
  private runManager: RunManager;
  private openClawAdapter: OpenClawAdapter;
  private db = getDB();

  constructor() {
    this.runManager = new RunManager();
    this.openClawAdapter = new OpenClawAdapter({
      baseURL: process.env.OPENCLAW_URL || 'http://localhost:18889'
    });
  }

  // 执行 Skill
  async executeSkill(context: ExecutionContext): Promise<ExecutionResult> {
    const { runId, skillId, input } = context;

    try {
      // 获取 Skill 配置
      const skill = await this.db.getSkill(skillId);
      if (!skill) {
        throw new Error(`Skill ${skillId} not found`);
      }

      // 更新状态为 running
      await this.runManager.updateStatus(runId, 'running');
      await this.runManager.logEvent(
        runId,
        context.sessionId,
        'skill.execution_started',
        { skill_id: skillId, skill_type: skill.skill_type },
        'platform'
      );

      // 根据 Skill 类型执行
      if (skill.skill_type === 'native_skill') {
        return await this.executeNativeSkill(context, skill);
      } else if (skill.skill_type === 'delegated_skill') {
        return await this.executeDelegatedSkill(context, skill);
      } else {
        throw new Error(`Unknown skill type: ${skill.skill_type}`);
      }

    } catch (error: any) {
      logger.error({ error, runId, skillId }, 'Skill execution failed');

      await this.runManager.updateStatus(runId, 'failed', {
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message
        }
      });

      await this.runManager.logEvent(
        runId,
        context.sessionId,
        'skill.execution_failed',
        { error: error.message },
        'platform'
      );

      return {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message: error.message
        }
      };
    }
  }

  // 执行 Native Skill
  private async executeNativeSkill(
    context: ExecutionContext,
    skill: Skill
  ): Promise<ExecutionResult> {
    const { runId, sessionId } = context;

    if (!skill.handler_ref) {
      throw new Error('Native skill missing handler_ref');
    }

    // 记录开始执行
    await this.runManager.logEvent(
      runId,
      sessionId,
      'native_skill.handler_invoked',
      { handler_ref: skill.handler_ref },
      'platform'
    );

    // TODO: 实现 handler 调用机制
    // 这里应该根据 handler_ref 加载并执行对应的 handler
    // 例如: dynamic import(handler_ref) 或从注册表中获取

    // 模拟执行成功
    const output = {
      result: 'Native skill executed',
      handler: skill.handler_ref
    };

    await this.runManager.updateStatus(runId, 'completed', { output });
    await this.runManager.logEvent(
      runId,
      sessionId,
      'skill.execution_completed',
      { output },
      'platform'
    );

    return {
      success: true,
      output
    };
  }

  // 执行 Delegated Skill (通过 OpenClaw)
  private async executeDelegatedSkill(
    context: ExecutionContext,
    skill: Skill
  ): Promise<ExecutionResult> {
    const { runId, sessionId, input } = context;

    if (!skill.runtime_config) {
      throw new Error('Delegated skill missing runtime_config');
    }

    // 记录开始调用 OpenClaw
    await this.runManager.logEvent(
      runId,
      sessionId,
      'openclaw.invocation_started',
      { skill_ref: skill.runtime_config.skill_ref },
      'platform'
    );

    try {
      // 调用 OpenClaw
      const result = await this.openClawAdapter.invokeSkill(skill, {
        skill_ref: skill.runtime_config.skill_ref,
        input,
        session_id: sessionId,
        run_id: runId
      });

      // 处理成功结果
      await this.runManager.updateStatus(runId, 'completed', {
        output: result
      });

      await this.runManager.logEvent(
        runId,
        sessionId,
        'openclaw.invocation_completed',
        { result },
        'openclaw'
      );

      return {
        success: true,
        output: result
      };

    } catch (error: any) {
      logger.error({ error, runId, skillId: skill.id }, 'OpenClaw invocation failed');

      await this.runManager.updateStatus(runId, 'failed', {
        error: {
          code: 'OPENCLAW_ERROR',
          message: error.message
        }
      });

      await this.runManager.logEvent(
        runId,
        sessionId,
        'openclaw.invocation_failed',
        { error: error.message },
        'openclaw'
      );

      return {
        success: false,
        error: {
          code: 'OPENCLAW_ERROR',
          message: error.message
        }
      };
    }
  }

  // 流式执行 Skill
  async *streamSkill(context: ExecutionContext): AsyncGenerator<any> {
    const { runId, skillId, input, sessionId } = context;

    try {
      const skill = await this.db.getSkill(skillId);
      if (!skill) {
        throw new Error(`Skill ${skillId} not found`);
      }

      // 更新状态
      await this.runManager.updateStatus(runId, 'running');

      if (skill.skill_type === 'delegated_skill' && skill.runtime_config) {
        // 流式调用 OpenClaw
        const stream = this.openClawAdapter.streamSkill(skill, {
          skill_ref: skill.runtime_config.skill_ref,
          input,
          session_id: sessionId,
          run_id: runId
        });

        for await (const chunk of stream) {
          // 记录事件
          await this.runManager.logEvent(
            runId,
            sessionId,
            `stream.${chunk.type}`,
            chunk,
            'openclaw'
          );

          yield chunk;
        }

        // 更新完成状态
        await this.runManager.updateStatus(runId, 'completed');
      } else {
        // Native skill 不支持流式
        const result = await this.executeNativeSkill(context, skill);
        yield {
          type: 'complete',
          result: result.output
        };
      }

    } catch (error: any) {
      logger.error({ error, runId }, 'Stream execution failed');

      await this.runManager.updateStatus(runId, 'failed', {
        error: {
          code: 'STREAM_ERROR',
          message: error.message
        }
      });

      yield {
        type: 'error',
        error: {
          code: 'STREAM_ERROR',
          message: error.message
        }
      };
    }
  }

  // 暂停执行
  async pauseRun(runId: string): Promise<void> {
    const run = await this.runManager.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    if (run.status !== 'running') {
      throw new Error(`Cannot pause run in ${run.status} status`);
    }

    await this.runManager.updateStatus(runId, 'paused');
    await this.runManager.logEvent(
      runId,
      run.session_id,
      'run.paused',
      {},
      'user'
    );
  }

  // 恢复执行
  async resumeRun(runId: string): Promise<void> {
    const run = await this.runManager.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    if (run.status !== 'paused') {
      throw new Error(`Cannot resume run in ${run.status} status`);
    }

    await this.runManager.updateStatus(runId, 'running');
    await this.runManager.logEvent(
      runId,
      run.session_id,
      'run.resumed',
      {},
      'user'
    );
  }
}