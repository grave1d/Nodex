import type { NodexConfig } from '../config.js';
import { sameNotionId } from '../transport/notion.js';
import {
  bindingInstructionsPageId,
  type DiscoveredNotionAgent,
} from '../transport/types.js';

export type AgentDiagnostic =
  | { kind: 'ok'; modelId: string; agent: DiscoveredNotionAgent }
  | { kind: 'workflow-id'; modelId: string; agent: DiscoveredNotionAgent; configuredId: string }
  | { kind: 'not-found'; modelId: string; configuredId: string };

export function diagnoseAgentBindings(
  config: Pick<NodexConfig, 'models'>,
  agents: readonly DiscoveredNotionAgent[],
): AgentDiagnostic[] {
  return Object.entries(config.models).map(([modelId, binding]): AgentDiagnostic => {
    const configuredId = bindingInstructionsPageId(binding);
    const current = agents.find((agent) => (
      sameNotionId(agent.agentInstructionsPageId, configuredId)
    ));
    if (current) return { kind: 'ok', modelId, agent: current };
    const workflow = agents.find((agent) => sameNotionId(agent.workflowId, configuredId));
    if (workflow) return { kind: 'workflow-id', modelId, agent: workflow, configuredId };
    return { kind: 'not-found', modelId, configuredId };
  });
}

export function diagnosticLines(diagnostics: readonly AgentDiagnostic[]): string[] {
  if (!diagnostics.length) return ['ERROR: No models configured. Run: nodex setup'];
  return diagnostics.map((diagnostic) => {
    if (diagnostic.kind === 'ok') return `OK: ${diagnostic.modelId} → ${diagnostic.agent.name}`;
    if (diagnostic.kind === 'workflow-id') {
      return `ERROR: ${diagnostic.modelId} uses a workflowId. Set agentInstructionsPageId to ${diagnostic.agent.agentInstructionsPageId}`;
    }
    return `ERROR: ${diagnostic.modelId} is not accessible in the current Notion workspace`;
  });
}
