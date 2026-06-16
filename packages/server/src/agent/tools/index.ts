import type { ToolName } from './schemas.js';
import { runParseIntentTool } from './parse-intent.tool.js';
import { runRetrieveAttractionsTool } from './retrieve-attractions.tool.js';
import { runRetrievePlaybooksTool } from './retrieve-playbooks.tool.js';
import { runGenerateRouteDraftTool } from './generate-route-draft.tool.js';
import { runEnrichRouteTool } from './enrich-route.tool.js';
import { runValidateRouteTool } from './validate-route.tool.js';
import { runPatchRouteDayTool } from './patch-route-day.tool.js';
import {
  runRecallUserMemoryTool,
  runWriteTripMemoryTool,
} from './memory.tools.js';

export type { ToolName } from './schemas.js';

export const AGENT_TOOL_NAMES: ToolName[] = [
  'parse_intent',
  'retrieve_attractions',
  'retrieve_playbooks',
  'generate_route_draft',
  'enrich_route',
  'validate_route',
  'patch_route_day',
  'recall_user_memory',
  'write_trip_memory',
];

export async function executeAgentTool(name: ToolName, input: unknown) {
  switch (name) {
    case 'parse_intent':
      return runParseIntentTool(input);
    case 'retrieve_attractions':
      return runRetrieveAttractionsTool(input);
    case 'retrieve_playbooks':
      return runRetrievePlaybooksTool(input);
    case 'generate_route_draft':
      return runGenerateRouteDraftTool(input);
    case 'enrich_route':
      return runEnrichRouteTool(input);
    case 'validate_route':
      return runValidateRouteTool(input);
    case 'patch_route_day':
      return runPatchRouteDayTool(input);
    case 'recall_user_memory':
      return runRecallUserMemoryTool(input);
    case 'write_trip_memory':
      return runWriteTripMemoryTool(input);
    default:
      return { ok: false as const, error: { message: `未知 Tool: ${name}`, code: 'UNKNOWN_TOOL' } };
  }
}
