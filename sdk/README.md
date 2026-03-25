# Agent Bridge SDK

Agent Bridge 平台的官方 TypeScript SDK，用于前端应用集成。

## 安装

```bash
npm install @agent-bridge/sdk
```

## 快速开始

```typescript
import { AgentBridge } from '@agent-bridge/sdk';

// 初始化 SDK
const bridge = new AgentBridge({
  endpoint: 'http://localhost:3000',
  appKey: 'your-app-key',
  appSecret: 'your-app-secret'
});

// 创建会话
const session = await bridge.createSession({
  userId: 'user_001',
  topic: 'AI写作助手'
});

// 流式调用 Skill
const stream = bridge.stream({
  sessionId: session.id,
  skillId: 'article_creation',
  input: {
    topic: 'AI发展趋势',
    keywords: ['人工智能', '未来']
  },
  handlers: {
    onChunk: (chunk) => {
      console.log('内容:', chunk.content);
    },
    onCompleted: (data) => {
      console.log('完成:', data);
    },
    onError: (error) => {
      console.error('错误:', error);
    }
  }
});
```

## 功能特性

- **Session 管理**: 创建、获取、列表、更新会话
- **Run 执行**: 同步和异步执行 Skill
- **流式输出**: WebSocket 实时流，支持断线重连
- **产物管理**: 创建、查询、更新 Artifact
- **记忆系统**: 读写长期记忆和工作记忆
- **自动重试**: 指数退避重试机制
- **类型安全**: 完整的 TypeScript 类型支持

## API 文档

### Session API

```typescript
// 创建会话
const session = await bridge.createSession({
  userId: 'user_001',
  topic: '会话主题',
  metadata: { ... }
});

// 获取会话
const session = await bridge.getSession(sessionId);

// 列会话
const sessions = await bridge.listSessions({
  userId: 'user_001',
  page: 1,
  limit: 20
});
```

### Run API

```typescript
// 创建运行
const run = await bridge.createRun({
  sessionId: 'session-id',
  skillId: 'skill-id',
  input: { ... }
});

// 获取运行状态
const run = await bridge.getRun(runId);

// 取消运行
await bridge.cancelRun(runId);

// 提交用户输入
await bridge.submitInput({
  runId: 'run-id',
  input: { ... }
});
```

### Stream API

```typescript
const stream = bridge.stream({
  sessionId: 'session-id',
  skillId: 'skill-id',
  input: { ... },
  handlers: {
    onChunk: (chunk) => { },
    onCheckpoint: (checkpoint) => { },
    onWaitingInput: (data) => { },
    onCompleted: (data) => { },
    onFailed: (error) => { },
    onDisconnected: () => { },
    onReconnected: () => { },
    onError: (error) => { }
  }
});

// 提交输入
stream.submitInput({ ... });

// 取消
stream.cancel();

// 断开连接
stream.disconnect();
```

### Artifact API

```typescript
// 列产物
const artifacts = await bridge.listArtifacts({
  sessionId: 'session-id',
  kind: 'draft',
  page: 1,
  limit: 20
});

// 获取产物
const artifact = await bridge.getArtifact(artifactId);

// 更新产物
await bridge.updateArtifact(artifactId, {
  content: '新内容',
  visibility: 'public'
});
```

### Memory API

```typescript
// 写入记忆
const memory = await bridge.writeMemory({
  ownerType: 'user',
  ownerId: 'user_001',
  memoryType: 'long_term',
  key: 'preference',
  value: { style: 'professional' },
  scope: ['writing']
});

// 查询记忆
const memories = await bridge.queryMemories({
  ownerType: 'user',
  ownerId: 'user_001',
  key: 'preference'
});

// 删除记忆
await bridge.deleteMemory(memoryId);
```

## 错误处理

SDK 提供了详细的错误类型：

```typescript
import { 
  AgentBridgeError, 
  ValidationError, 
  NotFoundError,
  RateLimitError,
  ConnectionError 
} from '@agent-bridge/sdk';

try {
  await bridge.createSession({ ... });
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('验证错误:', error.message);
  } else if (error instanceof RateLimitError) {
    console.error('限流，请稍后重试');
  } else if (error instanceof ConnectionError) {
    console.error('连接错误');
  }
}
```

## 配置选项

```typescript
interface AgentBridgeConfig {
  endpoint: string;      // API 端点
  appKey: string;        // App Key
  appSecret: string;     // App Secret
}
```

## 浏览器支持

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

## 许可证

MIT