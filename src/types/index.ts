// Agent Bridge 核心类型定义

// App
export interface App {
  id: string;
  name: string;
  type: 'miniprogram' | 'web' | 'im_bot' | 'custom';
  app_key: string;
  app_secret: string;
  config: {
    allowed_origins: string[];
    webhook_url?: string;
  };
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

// User (App-Scoped)
export interface User {
  id: string;
  app_id: string;
  external_id: string;
  principal_id?: string;
  profile: {
    nickname?: string;
    avatar?: string;
  };
  preferences: Record<string, any>;
  metadata: Record<string, any>;
  created_at: Date;
  last_active_at: Date;
}

// Session
export interface Session {
  id: string;
  app_id: string;
  user_id: string;
  title?: string;
  status: 'active' | 'paused' | 'completed' | 'expired';
  context: {
    topic?: string;
    current_phase?: string;
    variables: Record<string, any>;
  };
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}

// Run (8状态)
export type RunStatus = 
  | 'pending' 
  | 'running' 
  | 'waiting_user_input' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'timed_out' 
  | 'cancelled';

export interface Run {
  id: string;
  session_id: string;
  skill_id: string;
  skill_type: 'native_skill' | 'delegated_skill';
  status: RunStatus;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: {
    code: string;
    message: string;
  };
  waiting_input?: {
    prompt: string;
    expected_type?: string;
    timeout_ms: number;
  };
  metadata: {
    start_time: Date;
    end_time?: Date;
    duration_ms?: number;
    last_event_sequence: number;
    last_snapshot_id?: string;
  };
  created_at: Date;
}

// Skill
export interface Skill {
  id: string;
  name: string;
  skill_type: 'native_skill' | 'delegated_skill';
  handler_ref?: string;
  runtime_config?: {
    runtime: 'openclaw';
    skill_ref: string;
  };
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  config: {
    timeout_ms: number;
    allowed_tools: string[];
  };
  status: 'active' | 'deprecated';
  created_at: Date;
  updated_at: Date;
}

// Tool
export interface Tool {
  id: string;
  name: string;
  tool_type: 'platform_tool' | 'provider_tool';
  implementation?: {
    type: 'http' | 'javascript' | 'python';
    code?: string;
    endpoint?: string;
  };
  provider_config?: {
    runtime: 'openclaw';
    tool_ref: string;
  };
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  config: {
    timeout_ms: number;
  };
  status: 'active' | 'deprecated';
  created_at: Date;
  updated_at: Date;
}

// Artifact
export interface Artifact {
  id: string;
  run_id?: string;
  session_id?: string;
  owner_app_id: string;
  owner_user_id: string;
  artifact_kind: 
    | 'brief' 
    | 'outline' 
    | 'draft' 
    | 'final' 
    | 'material_card' 
    | 'feishu_doc' 
    | 'publish_record' 
    | 'extraction' 
    | 'custom';
  source_type: 'skill' | 'tool' | 'user' | 'import';
  source_ref: string;
  visibility: 'private' | 'session' | 'app' | 'public';
  content?: string;
  storage_uri?: string;
  metadata: {
    mime_type: string;
    size_bytes: number;
    title?: string;
    tags?: string[];
    version: number;
  };
  parent_id?: string;
  created_at: Date;
  updated_at: Date;
}

// Memory
export interface Memory {
  id: string;
  owner_type: 'app' | 'user' | 'session';
  owner_id: string;
  memory_type: 'long_term' | 'working' | 'contextual';
  key: string;
  value: any;
  scope: string[];
  metadata: {
    importance: number;
    access_count: number;
    last_accessed_at: Date;
    source_skill?: string;
    source_run?: string;
  };
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// Event Log
export interface RunEvent {
  id: string;
  run_id: string;
  session_id: string;
  event_type: string;
  payload: Record<string, any>;
  sequence: number;
  source: 'platform' | 'openclaw' | 'user';
  timestamp: Date;
}

// Snapshot
export interface RunSnapshot {
  id: string;
  run_id: string;
  snapshot_type: 'auto' | 'manual' | 'pre_tool' | 'post_tool';
  sequence: number;
  payload: {
    state_summary: {
      status: RunStatus;
      current_skill?: string;
      current_tool?: string;
      waiting_input?: boolean;
      input_prompt?: string;
    };
    content_snapshot?: {
      type: 'stream_text' | 'artifact_content';
      data: string;
      offset: number;
    };
    current_artifacts: string[];
    context: Record<string, any>;
  };
  created_at: Date;
}

// WebSocket 消息
export interface WSClientMessage {
  type: 'invoke' | 'resume' | 'input' | 'cancel' | 'ping';
  id: string;
  payload: Record<string, any>;
}

export interface WSServerMessage {
  type: string;
  id: string;
  run_id?: string;
  payload: Record<string, any>;
}
