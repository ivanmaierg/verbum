# openspec/

The human-readable trail of every Spec-Driven Development (SDD) change in verbum.

## Layout

| Path | Purpose |
|---|---|
| `config.yaml` | SDD configuration (project metadata, persistence mode, per-phase rules) |
| `changes/<name>/` | In-flight changes — artifacts as the change is being designed and built |
| `changes/archive/<name>/` | Shipped changes, frozen as documentation |

Each change directory contains the artifacts of its SDD lifecycle:

| File | Phase | Contents |
|---|---|---|
| `explore.md` | Exploration | Investigation, current state, options considered |
| `proposal.md` | Proposal | Intent, scope, locked decisions, success criterion |
| `spec.md` | Spec | Requirements, invariants, acceptance scenarios (WHEN/THEN) |
| `design.md` | Design | Architecture choices, file shapes, layer audit |
| `tasks.md` | Tasks | Ordered work units with acceptance criteria + commit boundaries |
| `apply-progress.md` | Apply | Implementation log with commit SHAs and test results |
| `verify-report.md` | Verify | Validation against spec; CRITICAL/WARNING/SUGGESTION findings |
| `archive-report.md` | Archive | Final state, decisions made along the way, traceability (archive only) |

## Persistence model

`mode: hybrid` in `config.yaml` — every SDD phase writes to BOTH:

1. **Engram** — the agent's persistent memory store (canonical, machine-readable, survives across sessions)
2. **`openspec/`** — these markdown files (canonical-equivalent, human-readable, committable, browseable on GitHub)

Engram is what the agent reads when continuing a change; openspec is what humans read when reviewing what was decided and why. Both are kept in sync by the orchestrator on every phase transition.

## Why this exists

The repo is the source of truth for the code. The SDD trail is the source of truth for the **rationale behind the code** — the tradeoffs considered, the alternatives rejected, the invariants the implementation must preserve. When a future change touches the same surface, this trail tells the next contributor (human or agent) what's load-bearing and what's safe to change.

Read the latest archive entries to understand why verbum looks the way it does. Read in-flight `changes/<name>/` directories to see what's currently being designed.
