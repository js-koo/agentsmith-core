# AgentSmith Core

**Multi-project AI Agent Orchestration System — Architecture & Interfaces**

This repository contains the architectural skeleton of AgentSmith: type definitions, interface contracts, agent/domain YAML schemas, and design philosophy.

> **Language**: Documentation is in English. 한국어 지원.

---

## Architecture

AgentSmith uses a **3-Layer architecture** that separates capabilities, processes, and execution:

```
┌─────────────────────────────────────────────────────────┐
│                  ClawWatch (Observer)                    │
│          Monitoring / Cost Tracking / Alerts            │
│            ← Independent service outside 3-Layer →      │
└──────────────────────┬──────────────────────────────────┘
                       │ observes
┌──────────────────────▼──────────────────────────────────┐
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │    core/     │  │   domains/   │  │   projects/   │  │
│  │ (Capability) │  │  (Process)   │  │  (Purpose)    │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│                                                         │
│                   AgentSmith Runtime                     │
└─────────────────────────────────────────────────────────┘
```

| Layer | What it holds | Who changes it |
|-------|--------------|----------------|
| **core/** | Agents, Tools, shared knowledge | Admin |
| **domains/** | Workflows, process definitions | Lead |
| **projects/** | Isolated execution, memory, config | Project owner |

### Execution Pipeline

```
Trigger (Discord / API / Schedule)
       │
       ▼
┌─────────────────┐
│ Context Assembler│  Assembles project + domain + agent + tools
│                 │  → ExecutionContext
└────────┬────────┘
         ▼
┌─────────────────┐
│   Validator     │  Checks scope, budget, version compatibility
└────────┬────────┘
         ▼
┌─────────────────┐
│ Workflow Engine │  State transitions, branching, retry
│                 │  Agent has NO flow control
└────────┬────────┘
         ▼
┌─────────────────┐
│     Agent       │  Pure judgment function (input → output)
└────────┬────────┘
         ▼
┌─────────────────┐
│     Tools       │  Idempotent side effects
└────────┬────────┘
         ▼
┌─────────────────┐
│  Run Recorder   │  State, cost, result → ClawWatch
└─────────────────┘
```

---

## What's in This Repository

This is the **skeleton** — types, interfaces, and declarative definitions only. No implementation logic.

```
agentsmith-core/
├── core/agents/general-assistant/   # Agent YAML definitions
│   ├── agent.yaml                   # Metadata, model, scope, overridable fields
│   ├── prompt.md                    # System prompt template
│   └── capabilities.yaml           # Available tools
│
├── domains/                         # Process definitions
│   ├── general/config.yaml
│   ├── general/workflows/freeform.yaml
│   └── marketing/workflows/freeform.yaml
│
├── orchestrator/src/types.ts        # Core TypeScript interfaces
│
└── docs/interfaces.ts               # Full interface contracts
```

---

## Key Design Decisions

### Agent = Pure Judgment Function

Agents receive input and return output. They do not call other agents, control flow, or decide what happens next. The Workflow Engine owns all flow control.

### Orchestrator Controls Flow

The Workflow Engine manages state transitions, conditional branching, retries, and approvals. Agents are invoked — never invoke.

### Connector Pattern

Projects exist independently. Discord is one access path among many (API, Schedule). Deleting a Discord channel removes only the connector, not the project or its data.

### Memory Isolation

Project memory is fully isolated. Cross-project sharing requires explicit export only — no automatic leaking.

### All Tools Must Be Idempotent

Every tool must produce the same result when called twice with the same input. The system assumes at-least-once execution.

---

## Run State Machine

```
         ┌──────────┐
         │ PENDING  │
         └────┬─────┘
              ▼
         ┌──────────┐     ┌───────────┐
         │ RUNNING  │────▶│ COMPLETED │
         └──┬─┬─┬───┘     └───────────┘
            │ │ │
            │ │ ├───▶ FAILED ──▶ RETRYING ──▶ RUNNING
            │ │ │
            │ │ ├───▶ CANCELLED
            │ │ │
            │ │ └───▶ TIMED_OUT
            │ │
            │ ├────▶ PAUSED ──▶ RUNNING (resume) / CANCELLED
            │ │
            │ └────▶ WAITING_APPROVAL ──▶ RUNNING (approve) / CANCELLED (reject)
```

9 states. All transitions are recorded and observable.

---

## Interfaces

See [docs/interfaces.ts](docs/interfaces.ts) and [orchestrator/src/types.ts](orchestrator/src/types.ts) for the full type contracts:

- `ExecutionContext` — everything needed to execute a run
- `AssemblyRequest` — trigger input to Context Assembler
- `WorkflowStep` / `ErrorPolicy` — workflow definition schema
- `ResolvedAgent` — core agent + overlay merge result
- `RunStatus` / `RunResult` — run state machine types
- `Connector` — access path abstraction

---

## Tech Stack

TypeScript, Node.js, Fastify, Next.js, PostgreSQL + pgvector, Redis, Discord.js, Langfuse, Vitest

---

## License

MIT
