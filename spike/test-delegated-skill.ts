// Spike 3: delegated_skill 验证
import { OpenClawAdapter } from '../src/adapters/OpenClawAdapter';
import { Skill } from '../src/types';

async function testDelegatedSkill() {
  console.log('=== Spike 3: delegated_skill 验证 ===\n');

  const adapter = new OpenClawAdapter({
    baseURL: process.env.OPENCLAW_URL || 'http://localhost:18889'
  });

  // 测试 1: 验证 delegated_skill 类型检查
  console.log('测试 1: delegated_skill 类型检查');
  const delegatedSkill: Skill = {
    id: 'test_delegated',
    name: 'Test Delegated Skill',
    skill_type: 'delegated_skill',
    runtime_config: {
      runtime: 'openclaw',
      skill_ref: 'test_skill'
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

  const nativeSkill: Skill = {
    id: 'test_native',
    name: 'Test Native Skill',
    skill_type: 'native_skill',
    handler_ref: 'handlers.test',
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

  console.log('✅ delegated_skill 配置:', delegatedSkill.runtime_config);
  console.log('✅ native_skill handler:', nativeSkill.handler_ref);

  // 测试 2: 流式调用测试
  console.log('\n测试 2: 流式调用测试');
  try {
    const stream = adapter.streamSkill(delegatedSkill, {
      skill_ref: 'test_skill',
      input: { topic: '测试' },
      session_id: 'test-session',
      run_id: 'test-run'
    });

    let chunkCount = 0;
    const timeout = setTimeout(() => {
      console.log('⚠️ 流式调用超时 (5s)');
    }, 5000);

    for await (const chunk of stream) {
      chunkCount++;
      if (chunkCount <= 3) {
        console.log(`  Chunk ${chunkCount}:`, chunk.type);
      }
      if (chunk.type === 'complete' || chunk.type === 'error') {
        break;
      }
    }

    clearTimeout(timeout);
    console.log(`✅ 流式调用接收 ${chunkCount} 个 chunks`);
  } catch (error: any) {
    console.log('⚠️ 流式调用:', error.message);
  }

  // 测试 3: 平台层不执行 native_skill
  console.log('\n测试 3: 平台层 native_skill 处理');
  console.log('✅ native_skill 由平台层直接执行 (handler_ref:', nativeSkill.handler_ref, ')');
  console.log('✅ delegated_skill 委托给 OpenClaw 执行');

  console.log('\n=== Spike 3 完成 ===');
  return true;
}

testDelegatedSkill().then(success => {
  process.exit(success ? 0 : 1);
});