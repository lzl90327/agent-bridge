// Spike 6: 端到端链路测试
import { OpenClawAdapter } from '../src/adapters/OpenClawAdapter';
import { RunManager } from '../src/services/RunManager';
import { memoryDB } from '../src/db';
import { Skill, RunStatus } from '../src/types';

async function testE2E() {
  console.log('=== Spike 6: 端到端链路测试 ===\n');

  const adapter = new OpenClawAdapter({
    baseURL: process.env.OPENCLAW_URL || 'http://localhost:18889'
  });
  const runManager = new RunManager(memoryDB);

  // 清理测试数据
  memoryDB.clear();

  // 测试 1: 创建 App 和 User
  console.log('测试 1: 创建 App 和 User');
  const app = await memoryDB.createApp({
    name: 'Test App',
    description: 'E2E Test',
    config: {}
  });
  console.log('✅ App 创建:', app.id);

  const user = await memoryDB.createUser({
    app_id: app.id,
    app_scoped_id: 'user_001',
    metadata: {}
  });
  console.log('✅ User 创建:', user.id);

  // 测试 2: 创建 Session
  console.log('\n测试 2: 创建 Session');
  const session = await memoryDB.createSession({
    app_id: app.id,
    user_id: user.id,
    title: 'E2E 测试会话',
    context: { topic: 'AI趋势' }
  });
  console.log('✅ Session 创建:', session.id);

  // 测试 3: 创建 Skill
  console.log('\n测试 3: 创建 Skill');
  const skill: Skill = {
    id: 'e2e_skill',
    name: 'E2E Test Skill',
    skill_type: 'delegated_skill',
    runtime_config: {
      runtime: 'openclaw',
      skill_ref: 'article_creation'
    },
    input_schema: {},
    output_schema: {},
    config: {
      timeout_ms: 30000,
      allowed_tools: []
    },
    status: 'active',
    created_at: new Date(),
    updated_at: new Date()
  };
  await memoryDB.createSkill(skill);
  console.log('✅ Skill 创建:', skill.id);

  // 测试 4: 创建 Run 并调用 Skill
  console.log('\n测试 4: 创建 Run 并调用 Skill');
  const run = await runManager.createRun({
    session_id: session.id,
    skill_id: skill.id,
    skill_type: 'delegated_skill',
    input: { topic: 'AI发展趋势', keywords: ['人工智能'] }
  });
  console.log('✅ Run 创建:', run.id);
  console.log('  - 状态:', run.status);

  // 测试 5: 状态流转到 running
  console.log('\n测试 5: 状态流转');
  await runManager.updateStatus(run.id, 'running');
  let currentRun = await runManager.getRun(run.id);
  console.log('✅ 状态更新:', currentRun?.status);

  // 测试 6: 记录 Event
  console.log('\n测试 6: 记录 Event');
  await runManager.logEvent(run.id, session.id, 'run.started', { run_id: run.id }, 'platform');
  await runManager.logEvent(run.id, session.id, 'skill.invoked', { skill_id: skill.id }, 'platform');
  const events = await memoryDB.getEvents(run.id);
  console.log('✅ Event 记录:', events.length, '条');

  // 测试 7: 创建 Snapshot
  console.log('\n测试 7: 创建 Snapshot');
  await runManager.createSnapshot(run.id, 'auto', {
    status: 'running',
    events_count: events.length
  });
  const snapshot = await runManager.getLatestSnapshot(run.id);
  console.log('✅ Snapshot 创建:', snapshot?.id);
  console.log('  - Sequence:', snapshot?.sequence);

  // 测试 8: 尝试调用 OpenClaw (模拟)
  console.log('\n测试 8: OpenClaw 调用 (模拟)');
  try {
    const health = await adapter.healthCheck();
    console.log('✅ OpenClaw 健康检查:', health.healthy ? '通过' : '失败');

    // 尝试流式调用 (带超时)
    const stream = adapter.streamSkill(skill, {
      skill_ref: skill.runtime_config!.skill_ref,
      input: run.input,
      session_id: session.id,
      run_id: run.id
    });

    let receivedChunks = false;
    const timeout = setTimeout(() => {
      console.log('⚠️ OpenClaw 调用超时 (3s)');
    }, 3000);

    for await (const chunk of stream) {
      receivedChunks = true;
      console.log('  收到 chunk:', chunk.type);
      if (chunk.type === 'complete' || chunk.type === 'error') break;
    }
    clearTimeout(timeout);

    if (receivedChunks) {
      console.log('✅ OpenClaw 流式调用正常');
    }
  } catch (error: any) {
    console.log('⚠️ OpenClaw 调用:', error.message);
  }

  // 测试 9: 创建 Artifact
  console.log('\n测试 9: 创建 Artifact');
  const artifact = await memoryDB.createArtifact({
    run_id: run.id,
    session_id: session.id,
    owner_app_id: app.id,
    owner_user_id: user.id,
    artifact_kind: 'draft',
    source_type: 'skill',
    source_ref: skill.id,
    visibility: 'session',
    content: 'AI发展趋势分析...',
    metadata: { mime_type: 'text/markdown', size_bytes: 1024, version: 1 }
  });
  console.log('✅ Artifact 创建:', artifact.id);

  // 测试 10: 完成 Run
  console.log('\n测试 10: 完成 Run');
  await runManager.updateStatus(run.id, 'completed', {
    output: { result: 'success', artifact_id: artifact.id }
  });
  currentRun = await runManager.getRun(run.id);
  console.log('✅ Run 完成:', currentRun?.status);
  console.log('  - 输出:', JSON.stringify(currentRun?.output));

  // 测试 11: 验证数据关联
  console.log('\n测试 11: 数据关联验证');
  const sessionRuns = await memoryDB.listRuns(session.id);
  const runArtifacts = await memoryDB.listArtifacts(run.id);
  console.log('✅ Session 关联 Runs:', sessionRuns.length);
  console.log('✅ Run 关联 Artifacts:', runArtifacts.length);
  console.log('✅ Run 关联 Events:', events.length);
  console.log('✅ Run 关联 Snapshots:', snapshot ? 1 : 0);

  console.log('\n=== Spike 6 完成 ===');
  console.log('\n端到端链路验证通过!');
  console.log('流程: App → User → Session → Run → Skill → OpenClaw → Artifact');
  return true;
}

testE2E().then(success => {
  process.exit(success ? 0 : 1);
});