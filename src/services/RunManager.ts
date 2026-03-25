import { Run, RunStatus, RunEvent, RunSnapshot } from '../types';
import { getDB, DBClient } from '../db';
import { v4 as uuidv4 } from 'uuid';

export class RunManager {
  private db: DBClient;

  constructor(db?: DBClient) {
    this.db = db || getDB();
  }

  // 创建 Run
  async createRun(data: Omit<Run, 'id' | 'created_at' | 'status' | 'metadata'>): Promise<Run> {
    const run: Run = {
      id: uuidv4(),
      ...data,
      status: 'pending',
      metadata: {
        start_time: new Date(),
        last_event_sequence: 0
      },
      created_at: new Date(),
      updated_at: new Date()
    };

    await this.db.createRun(run);
    return run;
  }

  // 更新 Run 状态
  async updateStatus(runId: string, status: RunStatus, data?: Partial<Run>): Promise<void> {
    const updates: Partial<Run> = { status, updated_at: new Date() };

    if (data?.output) updates.output = data.output;
    if (data?.error) updates.error = data.error;
    if (data?.waiting_input) updates.waiting_input = data.waiting_input;
    if (data?.metadata) updates.metadata = { ...data.metadata };

    await this.db.updateRun(runId, updates);
  }

  // 获取 Run
  async getRun(runId: string): Promise<Run | null> {
    return this.db.getRun(runId);
  }

  // 记录 Event
  async logEvent(runId: string, sessionId: string, eventType: string, payload: any, source: 'platform' | 'openclaw' | 'user'): Promise<RunEvent> {
    // 获取当前 sequence
    const events = await this.db.getEvents(runId);
    const sequence = events.length + 1;

    const event: RunEvent = {
      id: uuidv4(),
      run_id: runId,
      session_id: sessionId,
      event_type: eventType,
      payload,
      sequence,
      source,
      timestamp: new Date()
    };

    await this.db.logEvent(event);

    // 更新 run 的 last_event_sequence
    const run = await this.db.getRun(runId);
    if (run) {
      await this.db.updateRun(runId, {
        metadata: { ...run.metadata, last_event_sequence: sequence }
      });
    }

    return event;
  }

  // 创建 Snapshot
  async createSnapshot(runId: string, snapshotType: 'auto' | 'manual' | 'pre_tool' | 'post_tool', payload: any): Promise<RunSnapshot> {
    // 获取当前 sequence
    const latestSnapshot = await this.db.getLatestSnapshot(runId);
    const sequence = (latestSnapshot?.sequence || 0) + 1;

    const snapshot: RunSnapshot = {
      id: uuidv4(),
      run_id: runId,
      snapshot_type: snapshotType,
      sequence,
      payload,
      created_at: new Date()
    };

    await this.db.createSnapshot(snapshot);
    return snapshot;
  }

  // 获取最新 Snapshot
  async getLatestSnapshot(runId: string): Promise<RunSnapshot | null> {
    return this.db.getLatestSnapshot(runId);
  }

  // 获取 Snapshot 之后的事件
  async getEventsAfter(runId: string, sequence: number): Promise<RunEvent[]> {
    return this.db.getEvents(runId, sequence);
  }

  // 状态迁移检查
  canTransition(from: RunStatus, to: RunStatus): boolean {
    const transitions: Record<RunStatus, RunStatus[]> = {
      pending: ['running', 'cancelled'],
      running: ['waiting_user_input', 'paused', 'completed', 'failed', 'timed_out', 'cancelled'],
      waiting_user_input: ['running', 'cancelled'],
      paused: ['running', 'cancelled'],
      completed: [],
      failed: [],
      timed_out: [],
      cancelled: []
    };
    return transitions[from]?.includes(to) || false;
  }
}