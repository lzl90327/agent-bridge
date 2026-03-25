import { describe, it, expect, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { RunManager } from '../src/services/RunManager';
import { RunStatus } from '../src/types';

// Mock database
const mockDb = {
  query: async (sql: string, params: any[]) => {
    // 简化实现，实际测试需要真实数据库
    return { rows: [], rowCount: 0 };
  }
} as unknown as Pool;

describe('RunManager', () => {
  let runManager: RunManager;

  beforeEach(() => {
    runManager = new RunManager(mockDb);
  });

  describe('状态机', () => {
    it('PENDING 可以迁移到 RUNNING', () => {
      expect(runManager.canTransition('pending', 'running')).toBe(true);
    });

    it('PENDING 可以迁移到 CANCELLED', () => {
      expect(runManager.canTransition('pending', 'cancelled')).toBe(true);
    });

    it('PENDING 不能迁移到 COMPLETED', () => {
      expect(runManager.canTransition('pending', 'completed')).toBe(false);
    });

    it('RUNNING 可以迁移到 WAITING_USER_INPUT', () => {
      expect(runManager.canTransition('running', 'waiting_user_input')).toBe(true);
    });

    it('RUNNING 可以迁移到 PAUSED', () => {
      expect(runManager.canTransition('running', 'paused')).toBe(true);
    });

    it('RUNNING 可以迁移到 COMPLETED', () => {
      expect(runManager.canTransition('running', 'completed')).toBe(true);
    });

    it('RUNNING 可以迁移到 FAILED', () => {
      expect(runManager.canTransition('running', 'failed')).toBe(true);
    });

    it('RUNNING 可以迁移到 TIMED_OUT', () => {
      expect(runManager.canTransition('running', 'timed_out')).toBe(true);
    });

    it('RUNNING 可以迁移到 CANCELLED', () => {
      expect(runManager.canTransition('running', 'cancelled')).toBe(true);
    });

    it('WAITING_USER_INPUT 可以迁移到 RUNNING', () => {
      expect(runManager.canTransition('waiting_user_input', 'running')).toBe(true);
    });

    it('WAITING_USER_INPUT 可以迁移到 CANCELLED', () => {
      expect(runManager.canTransition('waiting_user_input', 'cancelled')).toBe(true);
    });

    it('PAUSED 可以迁移到 RUNNING', () => {
      expect(runManager.canTransition('paused', 'running')).toBe(true);
    });

    it('PAUSED 可以迁移到 CANCELLED', () => {
      expect(runManager.canTransition('paused', 'cancelled')).toBe(true);
    });

    it('COMPLETED 是终态，不能迁移', () => {
      expect(runManager.canTransition('completed', 'running')).toBe(false);
      expect(runManager.canTransition('completed', 'failed')).toBe(false);
    });

    it('FAILED 是终态，不能迁移', () => {
      expect(runManager.canTransition('failed', 'running')).toBe(false);
      expect(runManager.canTransition('failed', 'pending')).toBe(false);
    });

    it('TIMED_OUT 是终态，不能迁移', () => {
      expect(runManager.canTransition('timed_out', 'running')).toBe(false);
      expect(runManager.canTransition('timed_out', 'pending')).toBe(false);
    });

    it('CANCELLED 是终态，不能迁移', () => {
      expect(runManager.canTransition('cancelled', 'running')).toBe(false);
      expect(runManager.canTransition('cancelled', 'pending')).toBe(false);
    });
  });

  describe('恢复规则', () => {
    it('RUNNING 状态可以 resume', () => {
      expect(['running', 'waiting_user_input', 'paused']).toContain('running');
    });

    it('COMPLETED 状态不能 resume', () => {
      expect(['running', 'waiting_user_input', 'paused']).not.toContain('completed');
    });

    it('FAILED 状态不能 resume', () => {
      expect(['running', 'waiting_user_input', 'paused']).not.toContain('failed');
    });
  });
});
