import { Run, RunStatus, RunEvent, RunSnapshot } from '../types';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export class RunManager {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  // 创建 Run
  async createRun(data: Omit<Run, 'id' | 'created_at' | 'status' | 'metadata'>): Promise<Run> {
    const id = uuidv4();
    const run: Run = {
      id,
      ...data,
      status: 'pending',
      metadata: {
        start_time: new Date(),
        last_event_sequence: 0
      },
      created_at: new Date()
    };

    await this.db.query(
      `INSERT INTO runs (id, session_id, skill_id, skill_type, status, input, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.session_id, run.skill_id, run.skill_type, run.status, 
       JSON.stringify(run.input), JSON.stringify(run.metadata), run.created_at]
    );

    return run;
  }

  // 更新 Run 状态
  async updateStatus(runId: string, status: RunStatus, data?: Partial<Run>): Promise<void> {
    const updates: string[] = ['status = $1'];
    const values: any[] = [status];
    let paramIndex = 2;

    if (data?.output) {
      updates.push(`output = $${paramIndex++}`);
      values.push(JSON.stringify(data.output));
    }
    if (data?.error) {
      updates.push(`error = $${paramIndex++}`);
      values.push(JSON.stringify(data.error));
    }
    if (data?.waiting_input) {
      updates.push(`waiting_input = $${paramIndex++}`);
      values.push(JSON.stringify(data.waiting_input));
    }
    if (data?.metadata) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(data.metadata));
    }

    values.push(runId);
    await this.db.query(
      `UPDATE runs SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }

  // 获取 Run
  async getRun(runId: string): Promise<Run | null> {
    const result = await this.db.query('SELECT * FROM runs WHERE id = $1', [runId]);
    return result.rows[0] || null;
  }

  // 记录 Event
  async logEvent(runId: string, sessionId: string, eventType: string, payload: any, source: 'platform' | 'openclaw' | 'user'): Promise<RunEvent> {
    // 获取当前 sequence
    const seqResult = await this.db.query(
      'SELECT COALESCE(MAX(sequence), 0) + 1 as next_seq FROM run_events WHERE run_id = $1',
      [runId]
    );
    const sequence = seqResult.rows[0].next_seq;

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

    await this.db.query(
      `INSERT INTO run_events (id, run_id, event_type, payload, sequence, source, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [event.id, event.run_id, event.event_type, JSON.stringify(event.payload), 
       event.sequence, event.source, event.timestamp]
    );

    // 更新 run 的 last_event_sequence
    await this.db.query(
      `UPDATE runs SET metadata = jsonb_set(metadata, '{last_event_sequence}', $1::jsonb) WHERE id = $2`,
      [JSON.stringify(sequence), runId]
    );

    return event;
  }

  // 创建 Snapshot
  async createSnapshot(runId: string, snapshotType: 'auto' | 'manual' | 'pre_tool' | 'post_tool', payload: any): Promise<RunSnapshot> {
    // 获取当前 sequence
    const seqResult = await this.db.query(
      'SELECT COALESCE(MAX(sequence), 0) + 1 as next_seq FROM run_snapshots WHERE run_id = $1',
      [runId]
    );
    const sequence = seqResult.rows[0].next_seq;

    const snapshot: RunSnapshot = {
      id: uuidv4(),
      run_id: runId,
      snapshot_type: snapshotType,
      sequence,
      payload,
      created_at: new Date()
    };

    await this.db.query(
      `INSERT INTO run_snapshots (id, run_id, snapshot_type, sequence, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [snapshot.id, snapshot.run_id, snapshot.snapshot_type, snapshot.sequence, 
       JSON.stringify(snapshot.payload), snapshot.created_at]
    );

    return snapshot;
  }

  // 获取最新 Snapshot
  async getLatestSnapshot(runId: string): Promise<RunSnapshot | null> {
    const result = await this.db.query(
      'SELECT * FROM run_snapshots WHERE run_id = $1 ORDER BY sequence DESC LIMIT 1',
      [runId]
    );
    return result.rows[0] || null;
  }

  // 获取 Snapshot 之后的事件
  async getEventsAfter(runId: string, sequence: number): Promise<RunEvent[]> {
    const result = await this.db.query(
      'SELECT * FROM run_events WHERE run_id = $1 AND sequence > $2 ORDER BY sequence',
      [runId, sequence]
    );
    return result.rows;
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
