import { AgentBridgeConfig, Session, Run, Artifact, Memory, StreamHandlers } from './types';
import { StreamManager } from './StreamManager';

export class AgentBridge {
  private config: AgentBridgeConfig;
  private baseURL: string;

  constructor(config: AgentBridgeConfig) {
    this.config = config;
    this.baseURL = config.endpoint.replace(/\/$/, '');
  }

  // ===== Session API =====

  async createSession(params: {
    userId?: string;
    topic?: string;
    metadata?: Record<string, any>;
  }): Promise<Session> {
    const response = await this.fetch('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({
        app_key: this.config.appKey,
        user_id: params.userId,
        topic: params.topic,
        metadata: params.metadata
      })
    });

    return response.json();
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await this.fetch(`/api/v1/sessions/${sessionId}`);
    return response.json();
  }

  async listSessions(params: {
    userId: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Session[]; total: number; has_more: boolean }> {
    const query = new URLSearchParams({
      user_id: params.userId,
      page: String(params.page || 1),
      limit: String(params.limit || 20)
    });
    
    const response = await this.fetch(`/api/v1/sessions?${query}`);
    return response.json();
  }

  // ===== Run API =====

  async createRun(params: {
    sessionId: string;
    skillId: string;
    input: Record<string, any>;
  }): Promise<Run> {
    const response = await this.fetch('/api/v1/runs', {
      method: 'POST',
      body: JSON.stringify({
        session_id: params.sessionId,
        skill_id: params.skillId,
        input: params.input
      })
    });

    return response.json();
  }

  async getRun(runId: string): Promise<Run> {
    const response = await this.fetch(`/api/v1/runs/${runId}`);
    return response.json();
  }

  async cancelRun(runId: string): Promise<{ success: boolean }> {
    const response = await this.fetch(`/api/v1/runs/${runId}/cancel`, {
      method: 'POST'
    });
    return response.json();
  }

  async submitInput(params: {
    runId: string;
    input: any;
  }): Promise<Run> {
    const response = await this.fetch(`/api/v1/runs/${params.runId}/input`, {
      method: 'POST',
      body: JSON.stringify({ input: params.input })
    });
    return response.json();
  }

  // ===== Stream API =====

  stream(params: {
    sessionId: string;
    skillId: string;
    input: Record<string, any>;
    handlers: StreamHandlers;
  }): StreamManager {
    const manager = new StreamManager(this.config, params);
    manager.connect();
    return manager;
  }

  // ===== Artifact API =====

  async listArtifacts(params: {
    sessionId: string;
    kind?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: Artifact[]; total: number }> {
    const query = new URLSearchParams();
    if (params.kind) query.set('kind', params.kind);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const response = await this.fetch(
      `/api/v1/sessions/${params.sessionId}/artifacts?${query}`
    );
    return response.json();
  }

  async getArtifact(artifactId: string): Promise<Artifact> {
    const response = await this.fetch(`/api/v1/artifacts/${artifactId}`);
    return response.json();
  }

  async updateArtifact(
    artifactId: string,
    updates: Partial<Pick<Artifact, 'content' | 'name' | 'visibility' | 'metadata'>>
  ): Promise<Artifact> {
    const response = await this.fetch(`/api/v1/artifacts/${artifactId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
    return response.json();
  }

  // ===== Memory API =====

  async queryMemories(params: {
    ownerType: 'app' | 'user' | 'session';
    ownerId: string;
    key?: string;
    prefix?: string;
  }): Promise<{ items: Memory[] }> {
    const query = new URLSearchParams({
      owner_type: params.ownerType,
      owner_id: params.ownerId
    });
    if (params.key) query.set('key', params.key);
    if (params.prefix) query.set('prefix', params.prefix);

    const response = await this.fetch(`/api/v1/memories?${query}`);
    return response.json();
  }

  async writeMemory(params: {
    ownerType: 'app' | 'user' | 'session';
    ownerId: string;
    memoryType: 'long_term' | 'working' | 'contextual';
    key: string;
    value: any;
    scope?: string[];
    expiresAt?: string;
  }): Promise<Memory> {
    const response = await this.fetch('/api/v1/memories', {
      method: 'POST',
      body: JSON.stringify({
        owner_type: params.ownerType,
        owner_id: params.ownerId,
        memory_type: params.memoryType,
        key: params.key,
        value: params.value,
        scope: params.scope,
        expires_at: params.expiresAt
      })
    });
    return response.json();
  }

  async deleteMemory(memoryId: string): Promise<{ success: boolean }> {
    const response = await this.fetch(`/api/v1/memories/${memoryId}`, {
      method: 'DELETE'
    });
    return response.json();
  }

  // ===== Private =====

  private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseURL}${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-App-Key': this.config.appKey,
      'X-App-Secret': this.config.appSecret,
      ...((options.headers as Record<string, string>) || {})
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`API Error: ${error.message || response.statusText}`);
    }

    return response;
  }
}
