// Agent Bridge SDK 基本使用示例

import { AgentBridge } from '../src/index';

// 初始化 SDK
const bridge = new AgentBridge({
  endpoint: 'http://localhost:3000',
  appKey: 'your-app-key',
  appSecret: 'your-app-secret'
});

// 示例 1: 创建会话并运行 Skill
async function example1() {
  try {
    // 创建会话
    const session = await bridge.createSession({
      userId: 'user_001',
      topic: 'AI写作助手'
    });
    console.log('会话创建成功:', session.id);

    // 创建运行
    const run = await bridge.createRun({
      sessionId: session.id,
      skillId: 'article_creation',
      input: {
        topic: 'AI发展趋势',
        keywords: ['人工智能', '未来']
      }
    });
    console.log('运行创建成功:', run.id);

    // 获取运行状态
    const runStatus = await bridge.getRun(run.id);
    console.log('运行状态:', runStatus.status);

  } catch (error) {
    console.error('错误:', error);
  }
}

// 示例 2: 流式调用
async function example2() {
  const session = await bridge.createSession({
    userId: 'user_001',
    topic: '流式测试'
  });

  const stream = bridge.stream({
    sessionId: session.id,
    skillId: 'article_creation',
    input: { topic: '测试主题' },
    handlers: {
      onChunk: (chunk) => {
        console.log('收到内容:', chunk.content);
      },
      onCheckpoint: (checkpoint) => {
        console.log('检查点:', checkpoint.checkpoint_id);
      },
      onWaitingInput: (data) => {
        console.log('等待输入:', data.prompt);
        // 可以在这里调用 stream.submitInput({ ... })
      },
      onCompleted: (data) => {
        console.log('完成:', data);
      },
      onFailed: (error) => {
        console.error('失败:', error);
      },
      onDisconnected: () => {
        console.log('连接断开，正在重连...');
      },
      onReconnected: () => {
        console.log('已重连');
      },
      onError: (error) => {
        console.error('错误:', error);
      }
    }
  });

  // 等待流完成 (示例中简化处理)
  await new Promise(resolve => setTimeout(resolve, 30000));
}

// 示例 3: 记忆操作
async function example3() {
  // 写入记忆
  const memory = await bridge.writeMemory({
    ownerType: 'user',
    ownerId: 'user_001',
    memoryType: 'long_term',
    key: 'preferred_style',
    value: 'professional',
    scope: ['writing']
  });
  console.log('记忆写入成功:', memory.id);

  // 查询记忆
  const memories = await bridge.queryMemories({
    ownerType: 'user',
    ownerId: 'user_001'
  });
  console.log('记忆列表:', memories);
}

// 示例 4: 产物管理
async function example4() {
  // 列产物
  const artifacts = await bridge.listArtifacts({
    sessionId: 'session-id',
    kind: 'draft'
  });
  console.log('产物列表:', artifacts);

  // 获取产物内容
  const artifact = await bridge.getArtifact('artifact-id');
  console.log('产物:', artifact);
}

// 运行示例
if (require.main === module) {
  example1().catch(console.error);
}

export { example1, example2, example3, example4 };