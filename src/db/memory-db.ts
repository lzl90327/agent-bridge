// 内存数据库实现 - 用于开发和测试
// 生产环境请使用 PostgreSQL

import { v4 as uuidv4 } from 'uuid';
import {
  App, User, Session, Run, Skill, Tool, Artifact, Memory,
  RunEvent, RunSnapshot
} from '../types';

class MemoryDB {
  apps: Map<string, App> = new Map();
  users: Map<string, User> = new Map();
  sessions: Map<string, Session> = new Map();
  runs: Map<string, Run> = new Map();
  skills: Map<string, Skill> = new Map();
  tools: Map<string, Tool> = new Map();
  artifacts: Map<string, Artifact> = new Map();
  memories: Map<string, Memory> = new Map();
  runEvents: Map<string, RunEvent[]> = new Map();
  runSnapshots: Map<string, RunSnapshot[]> = new Map();

  // App CRUD
  async createApp(app: Omit<App, 'id' | 'created_at' | 'updated_at'>): Promise<App> {
    const newApp: App = {
      ...app,
      id: uuidv4(),
      created_at: new Date(),
      updated_at: new Date()
    };
    this.apps.set(newApp.id, newApp);
    return newApp;
  }

  async getApp(id: string): Promise<App | null> {
    return this.apps.get(id) || null;
  }

  async listApps(): Promise<App[]> {
    return Array.from(this.apps.values());
  }

  // User CRUD
  async createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const newUser: User = {
      ...user,
      id: uuidv4(),
      created_at: new Date(),
      updated_at: new Date()
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByAppScopedId(appId: string, appScopedId: string): Promise<User | null> {
    return Array.from(this.users.values()).find(
      u => u.app_id === appId && u.app_scoped_id === appScopedId
    ) || null;
  }

  // Session CRUD
  async createSession(session: Omit<Session, 'id' | 'created_at' | 'updated_at'>): Promise<Session> {
    const newSession: Session = {
      ...session,
      id: uuidv4(),
      created_at: new Date(),
      updated_at: new Date()
    };
    this.sessions.set(newSession.id, newSession);
    return newSession;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async listSessions(appId: string, userId?: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      s => s.app_id === appId && (!userId || s.user_id === userId)
    );
  }

  // Run CRUD
  async createRun(run: Omit<Run, 'id' | 'created_at' | 'updated_at'>): Promise<Run> {
    const newRun: Run = {
      ...run,
      id: uuidv4(),
      created_at: new Date(),
      updated_at: new Date()
    };
    this.runs.set(newRun.id, newRun);
    return newRun;
  }

  async getRun(id: string): Promise<Run | null> {
    return this.runs.get(id) || null;
  }

  async updateRun(id: string, updates: Partial<Run>): Promise<Run | null> {
    const run = this.runs.get(id);
    if (!run) return null;
    const updated = { ...run, ...updates, updated_at: new Date() };
    this.runs.set(id, updated);
    return updated;
  }

  async listRuns(sessionId: string): Promise<Run[]> {
    return Array.from(this.runs.values()).filter(r => r.session_id === sessionId);
  }

  // Skill CRUD
  async createSkill(skill: Omit<Skill, 'id' | 'created_at' | 'updated_at'>): Promise<Skill> {
    const newSkill: Skill = {
      ...skill,
      id: uuidv4(),
      created_at: new Date(),
      updated_at: new Date()
    };
    this.skills.set(newSkill.id, newSkill);
    return newSkill;
  }

  async getSkill(id: string): Promise<Skill | null> {
    return this.skills.get(id) || null;
  }

  async getSkillByRef(appId: string, ref: string): Promise<Skill | null> {
    return Array.from(this.skills.values()).find(
      s => s.app_id === appId && s.skill_ref === ref
    ) || null;
  }

  // Tool CRUD
  async createTool(tool: Omit<Tool, 'id' | 'created_at' | 'updated_at'>): Promise<Tool> {
    const newTool: Tool = {
      ...tool,
      id: uuidv4(),
      created_at: new Date(),
      updated_at: new Date()
    };
    this.tools.set(newTool.id, newTool);
    return newTool;
  }

  async getTool(id: string): Promise<Tool | null> {
    return this.tools.get(id) || null;
  }

  // Artifact CRUD
  async createArtifact(artifact: Omit<Artifact, 'id' | 'created_at' | 'updated_at'>): Promise<Artifact> {
    const newArtifact: Artifact = {
      ...artifact,
      id: uuidv4(),
      created_at: new Date(),
      updated_at: new Date()
    };
    this.artifacts.set(newArtifact.id, newArtifact);
    return newArtifact;
  }

  async getArtifact(id: string): Promise<Artifact | null> {
    return this.artifacts.get(id) || null;
  }

  async listArtifacts(runId?: string, sessionId?: string): Promise<Artifact[]> {
    return Array.from(this.artifacts.values()).filter(a => {
      if (runId && a.run_id !== runId) return false;
      if (sessionId && a.session_id !== sessionId) return false;
      return true;
    });
  }

  // Memory CRUD
  async createMemory(memory: Omit<Memory, 'id' | 'created_at'>): Promise<Memory> {
    const newMemory: Memory = {
      ...memory,
      id: uuidv4(),
      created_at: new Date()
    };
    this.memories.set(newMemory.id, newMemory);
    return newMemory;
  }

  async queryMemories(ownerType: string, ownerId: string, limit: number = 10): Promise<Memory[]> {
    return Array.from(this.memories.values())
      .filter(m => m.owner_type === ownerType && m.owner_id === ownerId)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  }

  // Run Events
  async logEvent(event: Omit<RunEvent, 'id'>): Promise<RunEvent> {
    const newEvent: RunEvent = {
      ...event,
      id: uuidv4()
    };
    const events = this.runEvents.get(event.run_id) || [];
    events.push(newEvent);
    this.runEvents.set(event.run_id, events);
    return newEvent;
  }

  async getEvents(runId: string, afterSequence?: number): Promise<RunEvent[]> {
    const events = this.runEvents.get(runId) || [];
    if (afterSequence) {
      return events.filter(e => e.sequence > afterSequence);
    }
    return events;
  }

  // Run Snapshots
  async createSnapshot(snapshot: Omit<RunSnapshot, 'id'>): Promise<RunSnapshot> {
    const newSnapshot: RunSnapshot = {
      ...snapshot,
      id: uuidv4()
    };
    const snapshots = this.runSnapshots.get(snapshot.run_id) || [];
    snapshots.push(newSnapshot);
    this.runSnapshots.set(snapshot.run_id, snapshots);
    return newSnapshot;
  }

  async getLatestSnapshot(runId: string): Promise<RunSnapshot | null> {
    const snapshots = this.runSnapshots.get(runId) || [];
    if (snapshots.length === 0) return null;
    return snapshots.sort((a, b) => b.sequence - a.sequence)[0];
  }

  // 清空数据库
  clear() {
    this.apps.clear();
    this.users.clear();
    this.sessions.clear();
    this.runs.clear();
    this.skills.clear();
    this.tools.clear();
    this.artifacts.clear();
    this.memories.clear();
    this.runEvents.clear();
    this.runSnapshots.clear();
  }
}

export const memoryDB = new MemoryDB();