// SDK 类型定义

export interface AgentBridgeConfig {
  endpoint: string;
  appKey: string;
  appSecret: string;
}

export interface Session {
  id: string;
  user_id: string;
  status: string;
  context: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  session_id: string;
  skill_id: string;
  skill_type: 'native_skill' | 'delegated_skill';
  status: RunStatus;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: { code: string; message: string };
  waiting_input?: {
    prompt: string;
    expected_type?: string;
    timeout_ms: number;
  };
  metadata: {
    start_time: string;
    end_time?: string;
    duration_ms?: number;
  };
  created_at: string;
}

export type RunStatus = 
  | 'pending' 
  | 'running' 
  | 'waiting_user_input' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'timed_out' 
  | 'cancelled';

export interface Artifact {
  id: string;
  run_id?: string;
  session_id?: string;
  artifact_kind: string;
  source_type: string;
  visibility: string;
  content?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Memory {
  id: string;
  owner_type: 'app' | 'user' | 'session';
  owner_id: string;
  memory_type: 'long_term' | 'working' | 'contextual';
  key: string;
  value: any;
  created_at: string;
}

// 流式事件
export interface StreamChunk {
  type: 'chunk';
  content: string;
  sequence: number;
}

export interface StreamCheckpoint {
  type: 'checkpoint';
  checkpoint_id: string;
  sequence: number;
}

export interface StreamWaitingInput {
  type: 'waiting_input';
  prompt: string;
  expected_type?: string;
  timeout_ms: number;
}

export interface StreamCompleted {
  type: 'completed';
  output?: Record<string, any>;
  artifacts: string[];
}

export interface StreamFailed {
  type: 'failed';
  error: { code: string; message: string };
  can_retry: boolean;
}

export interface StreamDisconnected {
  type: 'disconnected';
  reason: string;
}

export interface StreamReconnected {
  type: 'reconnected';
}

export type StreamEvent = 
  | StreamChunk 
  | StreamCheckpoint 
  | StreamWaitingInput 
  | StreamCompleted 
  | StreamFailed
  | StreamDisconnected
  | StreamReconnected;

// 事件处理器
export interface StreamHandlers {
  onChunk?: (chunk: StreamChunk) => void;
  onCheckpoint?: (checkpoint: StreamCheckpoint) => void;
  onWaitingInput?: (data: StreamWaitingInput) => void;
  onCompleted?: (data: StreamCompleted) => void;
  onFailed?: (data: StreamFailed) => void;
  onDisconnected?: (data: StreamDisconnected) => void;
  onReconnected?: (data: StreamReconnected) => void;
  onError?: (error: Error) => void;
}
