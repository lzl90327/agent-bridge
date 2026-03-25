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
    const result = await adapter.invokeSkill(skill, {
      skill_ref: 'article_creation',
      input: { topic: 'AI发展趋势', keywords: ['人工智能', '未来'] },
      session_id: 'test-session-1',
      run_id: 'test-run-1'
    });
    console.log('✅ Skill 调用成功:', result);
  } catch (error) {
    console.error('❌ Skill 调用失败:', error);
    return false;
  }

  // 测试 3: 超时处理
  console.log('\n测试 3: 超时处理');
  try {
    const timeoutSkill: Skill = {
      ...skill,
      config: { ...skill.config, timeout_ms: 100 } // 100ms 超时
    };
    await adapter.invokeSkill(timeoutSkill, {
      skill_ref: 'article_creation',
      input: { topic: 'test' },
      session_id: 'test-session-2',
      run_id: 'test-run-2'
    });
    console.log('⚠️ 应该超时但没有');
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.log('✅ 超时处理正常:', error.message);
    } else {
      console.error('❌ 超时处理异常:', error);
      return false;
    }
  }

  console.log('\n=== Spike 1 完成 ===');
  return true;
}

testOpenClawAdapter().then(success => {
  process.exit(success ? 0 : 1);
});
