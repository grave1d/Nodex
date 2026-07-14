import { expect, it } from 'vitest';
import type { Credentials } from '../src/auth/credentials.js';
import {
  InternalNotionTransport,
  type NotionFetcher,
  workflowModelMap,
} from '../src/transport/notion.js';
import type { AgentBinding, TransportRequest } from '../src/transport/types.js';

const credentials: Credentials = {
  token_v2: 'test-token',
  notion_browser_id: 'test-browser',
};

const capabilities: AgentBinding['capabilities'] = {
  reasoningSummaries: true,
  functionCalling: true,
  imageInput: false,
  fileInput: false,
  imageGeneration: false,
  imageEdit: false,
};

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function inferenceResponse(): Response {
  const line = JSON.stringify({
    type: 'agent-inference',
    value: [{ type: 'text', content: '{"type":"final","text":"done"}' }],
  });
  return new Response(`${line}\n`, {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson' },
  });
}

function accountResponse(): unknown {
  return {
    recordMap: {
      notion_user: {
        user: { value: { value: { given_name: 'Test', family_name: 'User', email: 'test@example.invalid' } } },
      },
      space: {
        space: { value: { value: { name: 'Test Space' } } },
      },
      space_view: {
        view: { value: { value: { space_id: 'space' } } },
      },
    },
  };
}

function workflowResponse(model: string): unknown {
  return {
    recordMap: {
      workflow: {
        workflow: {
          value: {
            value: {
              data: {
                instructions: { id: 'agent-page' },
                model: { type: model },
              },
            },
          },
        },
      },
    },
  };
}

function request(agent: AgentBinding, threadId: string): TransportRequest {
  return {
    threadId,
    newThread: true,
    message: 'test',
    agent,
    state: '{}',
    signal: new AbortController().signal,
    attachments: [],
  };
}

async function drain(chunks: AsyncIterable<string>): Promise<string> {
  let result = '';
  for await (const chunk of chunks) result += chunk;
  return result;
}

function harness(initialModel: string) {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const fetcher: NotionFetcher = async (path, init) => {
    const body = typeof init.body === 'string'
      ? JSON.parse(init.body) as Record<string, unknown>
      : {};
    calls.push({ path, body });

    if (path === 'loadUserContent') return jsonResponse(accountResponse());
    if (path === 'getCustomAgents') return jsonResponse({ agentIds: ['workflow'] });
    if (path === 'syncRecordValuesMain') return jsonResponse(workflowResponse(initialModel));
    if (path === 'saveTransactionsFanout') return jsonResponse({});
    if (path === 'publishCustomAgentVersion') {
      return jsonResponse({ workflowArtifactId: 'artifact', version: 2 });
    }
    if (path === 'runInferenceTranscript') return inferenceResponse();
    return new Response(null, { status: 404 });
  };

  return { calls, transport: new InternalNotionTransport(fetcher) };
}

it('extracts the internal model slug from a synced workflow record', () => {
  expect(workflowModelMap(workflowResponse('orange-mousse')).get('workflow'))
    .toBe('orange-mousse');
});

it('maps GPT-5.6 Sol and publishes a mismatched Notion agent model before inference', async () => {
  const { calls, transport } = harness('acai-budino-high');
  await transport.preflight(credentials);
  const agent: AgentBinding = {
    agentPageId: 'agent-page',
    agentName: 'Agent',
    notionModel: 'GPT-5.6 Sol',
    syncNotionModel: true,
    capabilities,
  };
  const turn = await transport.send(request(agent, 'thread-1'));
  await drain(turn.chunks);

  expect(calls.map((call) => call.path)).toEqual([
    'loadUserContent',
    'getCustomAgents',
    'syncRecordValuesMain',
    'saveTransactionsFanout',
    'publishCustomAgentVersion',
    'runInferenceTranscript',
  ]);
  const save = calls.find((call) => call.path === 'saveTransactionsFanout')?.body;
  expect(save).toMatchObject({
    transactions: [{
      spaceId: 'space',
      debug: { userAction: 'WorkflowActions.saveModel' },
      operations: [
        {
          pointer: { table: 'workflow', id: 'workflow', spaceId: 'space' },
          command: 'set',
          path: ['data', 'model'],
          args: { type: 'orange-mousse' },
        },
        {
          pointer: { table: 'workflow', id: 'workflow', spaceId: 'space' },
          command: 'update',
          path: [],
          args: {
            last_edited_by_id: 'user',
            last_edited_by_table: 'notion_user',
          },
        },
      ],
    }],
  });
  expect(calls.find((call) => call.path === 'publishCustomAgentVersion')?.body)
    .toEqual({ workflowId: 'workflow', spaceId: 'space' });
});

it('skips model mutations when Notion model synchronization is disabled', async () => {
  const { calls, transport } = harness('acai-budino-high');
  await transport.preflight(credentials);
  const agent: AgentBinding = {
    agentPageId: 'agent-page',
    agentName: 'Agent',
    notionModel: 'GPT-5.6 Sol',
    notionModelSlug: 'orange-mousse',
    syncNotionModel: false,
    capabilities,
  };
  const turn = await transport.send(request(agent, 'thread-1'));
  await drain(turn.chunks);

  expect(calls.map((call) => call.path)).toEqual([
    'loadUserContent',
    'getCustomAgents',
    'syncRecordValuesMain',
    'runInferenceTranscript',
  ]);
});

it('holds the workflow lock until inference streaming finishes', async () => {
  const { calls, transport } = harness('orange-mousse');
  await transport.preflight(credentials);
  const sol: AgentBinding = {
    agentPageId: 'agent-page',
    agentName: 'Agent',
    notionModel: 'GPT-5.6 Sol',
    notionModelSlug: 'orange-mousse',
    syncNotionModel: true,
    capabilities,
  };
  const terra: AgentBinding = {
    ...sol,
    notionModel: 'GPT-5.6 Terra',
    notionModelSlug: 'test-terra-slug',
  };
  const first = await transport.send(request(sol, 'thread-sol'));
  let secondSettled = false;
  const secondPromise = transport.send(request(terra, 'thread-terra')).then((turn) => {
    secondSettled = true;
    return turn;
  });

  await Promise.resolve();
  await Promise.resolve();
  expect(secondSettled).toBe(false);
  expect(calls.some((call) => call.path === 'saveTransactionsFanout')).toBe(false);

  await drain(first.chunks);
  const second = await secondPromise;
  const save = calls.find((call) => call.path === 'saveTransactionsFanout')?.body;
  const transactions = save?.['transactions'];
  const firstTransaction = Array.isArray(transactions) ? transactions[0] : undefined;
  const operations = firstTransaction && typeof firstTransaction === 'object'
    ? (firstTransaction as Record<string, unknown>)['operations']
    : undefined;
  expect(Array.isArray(operations) ? operations[0] : undefined)
    .toMatchObject({ args: { type: 'test-terra-slug' } });
  await drain(second.chunks);
});
