import { expect, it } from 'vitest';
import type { Credentials } from '../src/auth/credentials.js';
import { configSchema } from '../src/config.js';
import { diagnoseAgentBindings } from '../src/setup/diagnostics.js';
import {
  discoveredAgentsFromRecords,
  InternalNotionTransport,
  notionModelOptions,
  type NotionFetcher,
} from '../src/transport/notion.js';

const credentials: Credentials = {
  token_v2: 'synthetic-token',
  notion_browser_id: 'synthetic-browser',
};

function response(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function account(): unknown {
  return {
    recordMap: {
      notion_user: {
        user: { value: { value: { given_name: 'Test', email: 'test@example.invalid' } } },
      },
      space: {
        'space-id': { value: { value: { name: 'Test Workspace' } } },
      },
      space_view: {
        view: { value: { value: { space_id: 'space-id' } } },
      },
    },
  };
}

function workflows(): unknown {
  return {
    recordMap: {
      workflow: {
        'workflow-one': {
          value: { value: { data: {
            name: 'First Agent',
            instructions: { id: 'instructions-one' },
            model: { type: 'orange-mousse', displayName: 'GPT Test' },
          } } },
        },
        'workflow-two': {
          value: { value: { data: {
            name: 'Second Agent',
            instructions: { id: 'instructions-two' },
            model: { type: 'test-model' },
          } } },
        },
      },
    },
  };
}

it('extracts readable Custom Agents without sending inference requests', async () => {
  const calls: string[] = [];
  const fetcher: NotionFetcher = async (path) => {
    calls.push(path);
    if (path === 'loadUserContent') return response(account());
    if (path === 'getCustomAgents') return response({ agentIds: ['workflow-one', 'workflow-two'] });
    if (path === 'syncRecordValuesMain') return response(workflows());
    return new Response(null, { status: 404 });
  };
  const transport = new InternalNotionTransport(fetcher);
  await transport.preflight(credentials);
  const agents = await transport.discoverCustomAgents();

  expect(agents).toHaveLength(2);
  expect(agents[0]).toMatchObject({
    name: 'First Agent',
    workflowId: 'workflow-one',
    agentInstructionsPageId: 'instructions-one',
    spaceId: 'space-id',
    spaceName: 'Test Workspace',
    modelSlug: 'orange-mousse',
    modelName: 'GPT Test',
  });
  expect(agents[1]?.agentInstructionsPageId).toBe('instructions-two');
  expect(calls).toEqual(['loadUserContent', 'getCustomAgents', 'syncRecordValuesMain']);
  expect(calls).not.toContain('runInferenceTranscript');
});

it('returns an empty list when the account has no accessible agents', async () => {
  const calls: string[] = [];
  const fetcher: NotionFetcher = async (path) => {
    calls.push(path);
    if (path === 'loadUserContent') return response(account());
    if (path === 'getCustomAgents') return response({ agentIds: [] });
    return new Response(null, { status: 404 });
  };
  const transport = new InternalNotionTransport(fetcher);
  await transport.preflight(credentials);
  await expect(transport.discoverCustomAgents()).resolves.toEqual([]);
  expect(calls).toEqual(['loadUserContent', 'getCustomAgents']);
});

it('builds model choices from known and workspace-discovered agent models', () => {
  const agents = discoveredAgentsFromRecords(
    workflows(),
    ['workflow-one', 'workflow-two'],
    { id: 'space-id' },
  );
  expect(notionModelOptions(agents)).toEqual([
    { name: 'GPT Test', slug: 'orange-mousse' },
    { name: 'test-model', slug: 'test-model' },
  ]);
});

it('diagnoses a workflow ID and proposes the matching instructions page ID', () => {
  const agents = discoveredAgentsFromRecords(workflows(), ['workflow-one'], { id: 'space-id' });
  const config = configSchema.parse({
    models: {
      dev: {
        agentInstructionsPageId: 'workflow-one',
        agentName: 'First Agent',
        notionModel: 'GPT Test',
      },
    },
  });
  expect(diagnoseAgentBindings(config, agents)).toEqual([{
    kind: 'workflow-id',
    modelId: 'dev',
    configuredId: 'workflow-one',
    agent: agents[0],
  }]);
});
