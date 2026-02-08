/**
 * OpenClaw Runtime — Core Type Definitions
 */

// ============================================================
// Trigger & Assembly
// ============================================================

export type TriggerSource =
  | { type: 'discord'; channel_id: string; message: string; user_id: string }
  | { type: 'api'; project_id: string; payload: unknown }
  | { type: 'schedule'; schedule_id: string }
  | { type: 'chain'; parent_run_id: string; output: unknown };

export interface AssemblyRequest {
  source: TriggerSource;
  project_id?: string;
  domain_id?: string;
  workflow_id?: string;
}

export interface ExecutionContext {
  run_id: string;
  trigger: AssemblyRequest;

  project: {
    id: string;
    display_name: string;
    owner: string | null;
    budget: {
      monthly_usd: number | null;
      per_run_usd: number | null;
      remaining_usd: number | null;
    };
    context: Record<string, unknown>;
  };

  domain: {
    id: string;
    version: string | null;
  };

  workflow: {
    id: string;
    steps: WorkflowStep[];
    error_policy: ErrorPolicy;
  };

  agents: Record<string, ResolvedAgent>;
  tools: Record<string, ToolDefinition>;

  assembled_at: string;
  assembly_warnings: string[];
}

// ============================================================
// Assembly Errors
// ============================================================

export type AssemblyErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'DOMAIN_VERSION_NOT_FOUND'
  | 'DOMAIN_MIN_VERSION_VIOLATION'
  | 'WORKFLOW_NOT_FOUND'
  | 'AGENT_NOT_FOUND'
  | 'AGENT_OUT_OF_SCOPE'
  | 'OVERLAY_FORBIDDEN_FIELD'
  | 'TOOL_NOT_FOUND'
  | 'BUDGET_EXCEEDED';

export class AssemblyError extends Error {
  constructor(
    public code: AssemblyErrorCode,
    message: string,
    public trigger?: AssemblyRequest,
  ) {
    super(message);
    this.name = 'AssemblyError';
  }
}

// ============================================================
// Agent
// ============================================================

export interface AgentConfig {
  name: string;
  version: string;
  model: string;
  domain_scope: string[];
  input_schema: string;
  output_schema: string;
  overridable_fields: string[];
}

export interface AgentCapabilities {
  tools: Array<{
    name: string;
    condition?: string;
    always?: boolean;
  }>;
}

export interface OverlayConfig {
  extends: string;
  overrides: Record<string, unknown>;
}

export interface ResolvedAgent {
  name: string;
  version: string;
  model: string;
  domain_scope: string[];
  input_schema: string;
  output_schema: string;
  prompt: string;
  tools: string[];
  overlay_applied: boolean;
  overlay_source: string | null;
  [key: string]: unknown;
}

// ============================================================
// Workflow
// ============================================================

export interface WorkflowStep {
  agent: string;
  input: string;
  output: string;
  condition?: string;
  requires_approval?: boolean;
}

export interface WorkflowDefinition {
  name: string;
  version?: string;
  steps: WorkflowStep[];
  error_policy?: ErrorPolicy;
}

export interface ErrorPolicy {
  on_tool_failure: {
    retry: number;
    fallback: 'notify_human' | 'skip' | 'abort';
  };
  on_agent_failure: {
    retry: number;
    fallback: 'notify_human' | 'abort';
  };
  budget_limit_action: 'pause' | 'abort';
}

// ============================================================
// Run
// ============================================================

export type RunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'WAITING_APPROVAL'
  | 'PAUSED'
  | 'RETRYING'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface RunResult {
  run_id: string;
  status: RunStatus;
  output?: unknown;
  error?: string;
  steps_completed: number;
  total_tokens: number;
  total_cost_usd: number;
}

// ============================================================
// Tool
// ============================================================

export interface ToolDefinition {
  name: string;
  description?: string;
}

// ============================================================
// Project (DB row)
// ============================================================

export interface ProjectRow {
  id: string;
  display_name: string;
  domain: string;
  domain_version: string | null;
  status: string;
  config: Record<string, unknown>;
  budget_monthly_usd: number | null;
  budget_per_run_usd: number | null;
  owner: string | null;
  created_at: string;
}

// ============================================================
// Connector (DB row)
// ============================================================

export interface ConnectorRow {
  id: string;
  project_id: string;
  type: string;
  config: Record<string, unknown>;
  active: boolean;
  created_at: string;
}

// ============================================================
// Default Error Policy
// ============================================================

export const DEFAULT_ERROR_POLICY: ErrorPolicy = {
  on_tool_failure: { retry: 3, fallback: 'notify_human' },
  on_agent_failure: { retry: 1, fallback: 'abort' },
  budget_limit_action: 'pause',
};
