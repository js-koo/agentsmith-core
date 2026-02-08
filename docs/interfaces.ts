/**
 * OpenClaw Architecture — Interface Definitions
 *
 * 이 파일은 구현 코드가 아니라 설계 계약(contract)이다.
 * 각 컴포넌트가 무엇을 받고 무엇을 반환하는지 정의한다.
 */

// ============================================================
// 1. Trigger & Assembly
// ============================================================

/** Context Assembler의 입력 */
interface AssemblyRequest {
  source:
    | { type: "discord"; channel_id: string; message: string; user_id: string }
    | { type: "api"; project_id: string; payload: unknown }
    | { type: "schedule"; schedule_id: string }
    | { type: "chain"; parent_run_id: string; output: unknown };

  /** 명시적 지정 (있으면 자동 추론 건너뜀) */
  project_id?: string;
  domain_id?: string;
  workflow_id?: string;
}

/** Context Assembler의 출력. 실행에 필요한 모든 것. */
interface ExecutionContext {
  run_id: string;
  trigger: AssemblyRequest;

  project: {
    id: string;
    display_name: string;
    owner: string;
    budget: {
      monthly_usd: number;
      per_run_usd: number;
      remaining_usd: number;
    };
    context: Record<string, unknown>;
  };

  domain: {
    id: string;
    version: string;
  };

  workflow: {
    id: string;
    steps: WorkflowStep[];
    error_policy: ErrorPolicy;
  };

  /** core agent + overlay 병합 완료된 상태 */
  agents: Record<string, ResolvedAgent>;

  /** 사용 가능한 도구들 */
  tools: Record<string, ToolDefinition>;

  assembled_at: string;
  assembly_warnings: string[];
}

/** Context Assembler 실패 */
interface AssemblyError {
  code:
    | "PROJECT_NOT_FOUND"
    | "DOMAIN_VERSION_NOT_FOUND"
    | "DOMAIN_MIN_VERSION_VIOLATION"
    | "WORKFLOW_NOT_FOUND"
    | "AGENT_OUT_OF_SCOPE"
    | "OVERLAY_FORBIDDEN_FIELD"
    | "TOOL_NOT_FOUND"
    | "BUDGET_EXCEEDED";
  message: string;
  trigger: AssemblyRequest;
  timestamp: string;
}

// ============================================================
// 2. Agent
// ============================================================

/** core/agents/<name>/agent.yaml의 구조 */
interface AgentConfig {
  name: string;
  version: string;
  model: string;
  domain_scope: string[];
  input_schema: string;
  output_schema: string;
  overridable_fields: string[];
}

/** projects/<p>/agents/<name>.overlay.yaml의 구조 */
interface OverlayConfig {
  extends: string;
  overrides: Record<string, unknown>;
}

/** core agent + overlay 병합 결과 */
interface ResolvedAgent {
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
  /** overlay에서 덮어쓴 행동 파라미터들 */
  [key: string]: unknown;
}

/** core/agents/<name>/capabilities.yaml의 구조 */
interface AgentCapabilities {
  tools: Array<{
    name: string;
    condition?: string;
    always?: boolean;
  }>;
}

// ============================================================
// 3. Workflow
// ============================================================

/** domains/<d>/workflows/<w>.yaml의 단일 step */
interface WorkflowStep {
  agent: string;
  input: string;
  output: string;
  condition?: string;
  requires_approval?: boolean;
}

/** workflow 레벨 에러 정책 */
interface ErrorPolicy {
  on_tool_failure: {
    retry: number;
    fallback: "notify_human" | "skip" | "abort";
  };
  on_agent_failure: {
    retry: number;
    fallback: "notify_human" | "abort";
  };
  budget_limit_action: "pause" | "abort";
}

// ============================================================
// 4. Workflow Engine
// ============================================================

/** Workflow Engine 인터페이스 */
interface IWorkflowEngine {
  /** ExecutionContext를 받아 workflow를 실행한다 */
  execute(context: ExecutionContext): Promise<RunResult>;

  /** 일시정지/승인대기 중인 run을 재개한다 */
  resume(run_id: string, input?: unknown): Promise<RunResult>;

  /** 실행 중인 run을 일시정지한다 */
  pause(run_id: string): Promise<void>;

  /** run을 종료한다 */
  cancel(run_id: string): Promise<void>;
}

/** Workflow Engine의 실행 결과 */
interface RunResult {
  run_id: string;
  status: RunStatus;
  output?: unknown;
  error?: string;
  steps_completed: number;
  total_tokens: number;
  total_cost_usd: number;
}

// ============================================================
// 5. Run
// ============================================================

type RunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "WAITING_APPROVAL"
  | "PAUSED"
  | "RETRYING"
  | "CANCELLED"
  | "TIMED_OUT";

/** DB runs 테이블 row */
interface Run {
  id: string;
  project_id: string;
  workflow_id: string;
  status: RunStatus;
  state: Record<string, unknown>;
  context: ExecutionContext;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 6. Connector
// ============================================================

/** DB connectors 테이블 row */
interface Connector {
  id: string;
  project_id: string;
  type: "discord" | "api" | "schedule";
  config: DiscordConnectorConfig | ApiConnectorConfig | ScheduleConnectorConfig;
  created_at: string;
}

interface DiscordConnectorConfig {
  channel_id: string;
  channel_name: string;
}

interface ApiConnectorConfig {
  api_key: string;
}

interface ScheduleConnectorConfig {
  cron: string;
  workflow_id: string;
}

// ============================================================
// 7. Project
// ============================================================

/** DB projects 테이블 row */
interface Project {
  id: string;
  display_name: string;
  domain: string;
  status: "active" | "archived";
  config: ProjectConfig | null;
  created_at: string;
}

/** projects/<p>/project.yaml의 구조 */
interface ProjectConfig {
  name: string;
  domain: string;
  domain_version?: string;
  budget?: {
    monthly_usd: number;
    per_run_usd: number;
  };
  owner: string;
}

// ============================================================
// 8. Tool
// ============================================================

/** core/tools/<name>/의 정의 */
interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
}

// ============================================================
// 9. Observability Events
// ============================================================

/** ClawWatch로 전송되는 이벤트들 */
type OrchestratorEvent =
  | {
      type: "orchestrator.context_assembled";
      project_id: string;
      domain: string;
      agents: string[];
      duration_ms: number;
      timestamp: string;
    }
  | {
      type: "orchestrator.assembly_failed";
      reason: string;
      trigger: AssemblyRequest;
      timestamp: string;
    }
  | {
      type: "orchestrator.validation_passed";
      run_id: string;
      timestamp: string;
    }
  | {
      type: "orchestrator.validation_failed";
      reason: string;
      context_snapshot: Partial<ExecutionContext>;
      timestamp: string;
    }
  | {
      type: "orchestrator.step_started";
      run_id: string;
      step: number;
      agent: string;
      input: unknown;
      timestamp: string;
    }
  | {
      type: "orchestrator.step_completed";
      run_id: string;
      step: number;
      agent: string;
      output: unknown;
      duration_ms: number;
      tokens: number;
      timestamp: string;
    }
  | {
      type: "orchestrator.state_transition";
      run_id: string;
      from: RunStatus;
      to: RunStatus;
      reason?: string;
      timestamp: string;
    }
  | {
      type: "run.completed";
      run_id: string;
      total_cost_usd: number;
      total_duration_ms: number;
      timestamp: string;
    }
  | {
      type: "run.failed";
      run_id: string;
      error: string;
      failed_step: number;
      timestamp: string;
    };
