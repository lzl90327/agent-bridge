# Agent Bridge

Agent 接入与运行平台 - 以 OpenClaw 为首个适配器

## 项目定位

- **控制层**: 拥有 Session / Run / Memory / Artifact 的最终控制权
- **首适配器**: OpenClaw 是 V1 首个 Runtime Adapter
- **服务目标**: 先服务自家创作助手

## 核心特性

- 8 状态 Run 状态机 (含等待输入/暂停/超时)
- Event Log + Snapshot 三层恢复机制
- native_skill (handler_ref) + delegated_skill 分层
- platform_tool (强控制) + provider_tool (最佳努力)
- App-Scoped 用户模型

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 配置数据库和 OpenClaw 连接

# 数据库迁移
npm run db:migrate

# 开发模式
npm run dev

# 生产构建
npm run build
npm start
```

## API 文档

### REST API

- `POST /api/v1/sessions` - 创建会话
- `GET /api/v1/sessions/:id` - 获取会话
- `POST /api/v1/runs` - 启动运行
- `GET /api/v1/runs/:id` - 获取运行状态
- `POST /api/v1/runs/:id/cancel` - 取消运行
- `POST /api/v1/runs/:id/input` - 提交用户输入
- `GET /api/v1/sessions/:id/artifacts` - 获取产物列表
- `GET /api/v1/memories` - 查询记忆
- `POST /api/v1/memories` - 写入记忆

### WebSocket API

连接: `WS /api/v1/stream?token={token}&session_id={id}`

客户端消息:
- `invoke` - 启动流式调用
- `resume` - 恢复流式调用
- `input` - 提交用户输入
- `cancel` - 取消运行
- `ping` - 心跳

服务端消息:
- `run_started` - 运行开始
- `chunk` - 流式内容
- `checkpoint` - 检查点
- `waiting_input` - 等待用户输入
- `run_completed` - 运行完成
- `run_failed` - 运行失败

## 技术栈

- Node.js + TypeScript
- Express + WebSocket
- PostgreSQL + Redis
- OpenClaw Adapter

## 开发路线图

- Phase 0: 技术 Spike (2-3 周)
- Phase 1: 核心框架 (4 周)
- Phase 2: Skill/Tool (3 周)
- Phase 3: 流式与恢复 (3 周)
- Phase 4: SDK 与接入 (2 周)
- Phase 5: 生产准备 (2 周)

## License

MIT
