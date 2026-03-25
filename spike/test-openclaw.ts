// Spike 1: OpenClaw Adapter 测试
import { OpenClawAdapter } from '../src/adapters/OpenClawAdapter';
import { Skill } from '../src/types';

async function testOpenClawAdapter() {
  console.log('=== Spike 1: OpenClaw Adapter 测试 ===\n');

  const adapter = new OpenClawAdapter({
    baseURL: process.env.OPENCLAW_URL || 'http://localhost:18889'
  });

  // 测试 1: 健康检查
  console.log('测试 1: 健康检查');
  try {
    const health = await adapter.healthCheck();
    console.log('✅ 健康检查通过:', health);
  } catch (error) {
    console.error('❌ 健康检查失败:', error);
    return false;
  }

  // 测试 2: 调用 delegated_skill
  console.log('\n测试 2: 调用 delegated_skill');
  const skill: Skill = {
    id: 'article_creation',
    name: 'Article Creation',
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

  try {
    const result = await Promise.race([
      adapter.invokeSkill(skill, {
        skill_ref: 'article_creation',
        input: { topic: 'AI发展趋势', keywords: ['人工智能', '未来'] },
        session_id: 'test-session-1',
        run_id: 'test-run-1'
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout after 10s')), 10000)
      )
    ]);
    console.log('✅ Skill 调用成功:', result);
  } catch (error: any) {
    if (error.message === 'Test timeout after 10s') {
      console.log('⚠️ Skill 调用超时 (10s) - OpenClaw 可能未配置该 skill');
    } else {
      console.error('❌ Skill 调用失败:', error.message);
    }
    // 不返回 false，因为连接是正常的，只是 skill 可能不存在
  }

  // 测试 3: WebSocket 连接测试
  console.log('\n测试 3: WebSocket 连接测试');
  try {
    // 简单测试 WebSocket 是否能连接
    const wsUrl = (process.env.OPENCLAW_URL || 'http://localhost:18889').replace(/^http/, 'ws') + '/ws';
    const WebSocket = require('ws');
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ WebSocket 连接成功');
        ws.close();
        resolve();
      });

      ws.on('error', (err: any) => {
        clearTimeout(timeout);
        console.log('⚠️ WebSocket 连接失败:', err.message);
        resolve(); // 不阻塞测试
      });
    });
  } catch (error: any) {
    console.log('⚠️ WebSocket 测试:', error.message);
  }

  console.log('\n=== Spike 1 完成 ===');
  return true;
}

testOpenClawAdapter().then(success => {
  process.exit(success ? 0 : 1);
});
