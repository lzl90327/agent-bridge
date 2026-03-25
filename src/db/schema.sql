-- Agent Bridge 数据库 Schema

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- App 表
CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('miniprogram', 'web', 'im_bot', 'custom')),
  app_key VARCHAR(255) UNIQUE NOT NULL,
  app_secret VARCHAR(255) NOT NULL,
  config JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User 表 (App-Scoped)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  principal_id UUID,
  profile JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(app_id, external_id)
);

-- Session 表
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'expired')),
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 days'
);

-- Run 表 (8状态)
CREATE TABLE runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  skill_id VARCHAR(255) NOT NULL,
  skill_type VARCHAR(50) NOT NULL CHECK (skill_type IN ('native_skill', 'delegated_skill')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'waiting_user_input', 'paused', 'completed', 'failed', 'timed_out', 'cancelled')),
  input JSONB DEFAULT '{}',
  output JSONB,
  error JSONB,
  waiting_input JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skill 表
CREATE TABLE skills (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  skill_type VARCHAR(50) NOT NULL CHECK (skill_type IN ('native_skill', 'delegated_skill')),
  handler_ref VARCHAR(255),
  runtime_config JSONB,
  input_schema JSONB NOT NULL DEFAULT '{}',
  output_schema JSONB NOT NULL DEFAULT '{}',
  config JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tool 表
CREATE TABLE tools (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tool_type VARCHAR(50) NOT NULL CHECK (tool_type IN ('platform_tool', 'provider_tool')),
  implementation JSONB,
  provider_config JSONB,
  input_schema JSONB NOT NULL DEFAULT '{}',
  output_schema JSONB NOT NULL DEFAULT '{}',
  config JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deprecated')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Artifact 表
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  owner_app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artifact_kind VARCHAR(50) NOT NULL CHECK (artifact_kind IN ('brief', 'outline', 'draft', 'final', 'material_card', 'feishu_doc', 'publish_record', 'extraction', 'custom')),
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('skill', 'tool', 'user', 'import')),
  source_ref VARCHAR(255) NOT NULL,
  visibility VARCHAR(50) DEFAULT 'private' CHECK (visibility IN ('private', 'session', 'app', 'public')),
  content TEXT,
  storage_uri VARCHAR(500),
  metadata JSONB DEFAULT '{}',
  parent_id UUID REFERENCES artifacts(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Memory 表
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_type VARCHAR(50) NOT NULL CHECK (owner_type IN ('app', 'user', 'session')),
  owner_id UUID NOT NULL,
  memory_type VARCHAR(50) NOT NULL CHECK (memory_type IN ('long_term', 'working', 'contextual')),
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  scope TEXT[] DEFAULT ARRAY['*'],
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_type, owner_id, key)
);

-- Run Event 表
CREATE TABLE run_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB DEFAULT '{}',
  sequence INTEGER NOT NULL,
  source VARCHAR(50) NOT NULL CHECK (source IN ('platform', 'openclaw', 'user')),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(run_id, sequence)
);

-- Run Snapshot 表
CREATE TABLE run_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  snapshot_type VARCHAR(50) NOT NULL CHECK (snapshot_type IN ('auto', 'manual', 'pre_tool', 'post_tool')),
  sequence INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(run_id, sequence)
);

-- 索引
CREATE INDEX idx_users_app ON users(app_id, external_id);
CREATE INDEX idx_sessions_user ON sessions(user_id, updated_at DESC);
CREATE INDEX idx_runs_session ON runs(session_id, created_at DESC);
CREATE INDEX idx_artifacts_owner ON artifacts(owner_user_id, artifact_kind, created_at DESC);
CREATE INDEX idx_artifacts_session ON artifacts(session_id, created_at DESC);
CREATE INDEX idx_memories_owner ON memories(owner_type, owner_id, memory_type);
CREATE INDEX idx_run_events_run ON run_events(run_id, sequence);
CREATE INDEX idx_run_snapshots_run ON run_snapshots(run_id, sequence DESC);
