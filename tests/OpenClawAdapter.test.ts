import { describe, it, expect, vi } from 'vitest';
import { OpenClawAdapter } from '../src/adapters/OpenClawAdapter';
import { Skill, Tool } from '../src/types';

describe('OpenClawAdapter', () => {
  const mockConfig = {
    baseURL: 'http://localhost:18889',
    apiKey: 'test-key'
  };

  describe('Skill 调用', () => {
    it('应该拒绝非 delegated_skill', async () => {
      const adapter = new OpenClawAdapter(mockConfig);
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test',
        skill_type: 'native_skill',
        input_schema: {},
        output_schema: {},
        config: { timeout_ms: 30000, allowed_tools: [] },
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      await expect(adapter.invokeSkill(skill, {
        skill_ref: 'test',
        input: {},
        session_id: 'sess-1',
        run_id: 'run-1'
      })).rejects.toThrow('Skill is not delegated to OpenClaw');
    });
  });

  describe('Tool 调用', () => {
    it('应该拒绝非 provider_tool', async () => {
      const adapter = new OpenClawAdapter(mockConfig);
      const tool: Tool = {
        id: 'test-tool',
        name: 'Test',
        tool_type: 'platform_tool',
        input_schema: {},
        output_schema: {},
        config: { timeout_ms: 30000 },
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      await expect(adapter.invokeTool(tool, {
        tool_ref: 'test',
        input: {},
        session_id: 'sess-1',
        run_id: 'run-1'
      })).rejects.toThrow('Tool is not a provider tool');
    });
  });
});
