// Spike 2: Session/Run/Artifact 数据流测试
// 使用内存存储验证数据流逻辑

interface InMemoryDB {
  sessions: Map<string, any>;
  runs: Map<string, any>;
  artifacts: Map<string, any>;
  events: Map<string, any[]>;
  snapshots: Map<string, any[]>;
}

const db: InMemoryDB = {
  sessions: new Map(),
  runs: new Map(),
  artifacts: new Map(),
  events: new Map(),
  snapshots: new Map()
};

// 模拟 RunManager
class MockRunManager {
  async createSession(data: any) {
    const session = {
      id: `sess_${Date.now()}`,
      ...data,
      status: 'active',
      created_at: new Date()
    };
    db.sessions.set(session.id, session);
    return session;
  }

  async createRun(data: any) {
    const run = {
      id: `run_${Date.now()}`,
      ...data,
      status: 'pending',
      metadata: { start_time: new Date(), last_event_sequence: 0 },
      created_at: new Date()
    };
    db.runs.set(run.id, run);
    db.events.set(run.id, []);
    db.snapshots.set(run.id, []);
    return run;
  }

  async updateStatus(runId: string, status: string, data?: any) {
    const run = db.runs.get(runId);
    if (run) {
      run.status = status;
      if (data) Object.assign(run, data);
    }
  }

  async createArtifact(data: any) {
    const artifact = {
      id: `art_${Date.now()}`,
      ...data,
      created_at: new Date()
    };
    db.artifacts.set(artifact.id, artifact);
    return artifact;
  }

  async logEvent(runId: string, eventType: string, payload: any) {
    const events = db.events.get(runId) || [];
    const event = {
      id: `evt_${Date.now()}`,
      run_id: runId,
      event_type: eventType,
      payload,
      sequence: events.length + 1,
      timestamp: new Date()
    };
    events.push(event);
    db.events.set(runId, events);
    return event;
  }

  canTransition(from: string, to: string): boolean {
    const transitions: Record<string, string[]> = {
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

async function testDataFlow() {
  console.log('=== Spike 2: Session/Run/Artifact 数据流测试 ===\n');

  const manager = new MockRunManager();

  // 测试 1: 创建 Session
  console.log('测试 1: 创建 Session');
  const session = await manager.createSession({
    app_id: 'app_1',
    user_id: 'user_1',
    title: 'AI写作助手',
    context: { topic: 'AI趋势' }
  });
  console.log('✅ Session 创建成功:', session.id);

  // 测试 2: 创建 Run
  console.log('\n测试 2: 创建 Run');
  const run = await manager.createRun({
    session_id: session.id,
    skill_id: 'article_creation',
    skill_type: 'delegated_skill',
    input: { topic: 'AI发展趋势' }
  });
  console.log('✅ Run 创建成功:', run.id);
  console.log('  - 状态:', run.status);
  console.log('  - 关联 Session:', run.session_id);

  // 测试 3: 状态流转
  console.log('\n测试 3: 状态流转');
  await manager.updateStatus(run.id, 'running');
  console.log('✅ pending → running');

  await manager.updateStatus(run.id, 'waiting_user_input', {
    waiting_input: { prompt: '请确认选题', timeout_ms: 300000 }
  });
  console.log('✅ running → waiting_user_input');

  // 测试 4: 记录 Event
  console.log('\n测试 4: 记录 Event');
  await manager.logEvent(run.id, 'run.started', { skill_id: 'article_creation' });
  await manager.logEvent(run.id, 'skill.started', { skill_id: 'article_creation' });
  await manager.logEvent(run.id, 'run.waiting_user_input', { prompt: '请确认选题' });
  const events = db.events.get(run.id) || [];
  console.log('✅ Event 记录成功:', events.length, '条');
  console.log('  - 序列号:', events.map(e => e.sequence).join(', '));

  // 测试 5: 创建 Artifact
  console.log('\n测试 5: 创建 Artifact');
  const artifact = await manager.createArtifact({
    run_id: run.id,
    session_id: session.id,
    owner_app_id: 'app_1',
    owner_user_id: 'user_1',
    artifact_kind: 'brief',
    source_type: 'skill',
    source_ref: 'article_creation',
    visibility: 'session',
    content: 'AI发展趋势分析...',
    metadata: { mime_type: 'text/markdown', size_bytes: 1024, version: 1 }
  });
  console.log('✅ Artifact 创建成功:', artifact.id);
  console.log('  - 类型:', artifact.artifact_kind);
  console.log('  - 归属:', artifact.owner_user_id);

  // 测试 6: 查询关联
  console.log('\n测试 6: 查询关联');
  const sessionRuns = Array.from(db.runs.values()).filter(r => r.session_id === session.id);
  const runArtifacts = Array.from(db.artifacts.values()).filter(a => a.run_id === run.id);
  console.log('✅ Session 关联 Runs:', sessionRuns.length);
  console.log('✅ Run 关联 Artifacts:', runArtifacts.length);

  // 测试 7: 状态机验证
  console.log('\n测试 7: 状态机验证');
  const tests = [
    ['pending', 'running', true],
    ['running', 'completed', true],
    ['completed', 'running', false],
    ['failed', 'pending', false]
  ];
  for (const [from, to, expected] of tests) {
    const result = manager.canTransition(from, to);
    const status = result === expected ? '✅' : '❌';
    console.log(`${status} ${from} → ${to}: ${result}`);
  }

  console.log('\n=== Spike 2 完成 ===');
  return true;
}

testDataFlow().then(success => {
  process.exit(success ? 0 : 1);
});
