# Skill Registry — verbum

Last scanned: 2026-05-09
Source: `~/.claude/skills/` (user-level) + `<available_skills>` system block

## User Skills

| Name | Trigger | Compact Rules |
|---|---|---|
| cognitive-doc-design | Writing guides, READMEs, RFCs, architecture docs, onboarding | Lead with the answer; progressive disclosure; chunking; signposting; recognition over recall (tables, checklists); review empathy |
| chained-pr | PRs over 400 lines, stacked PRs, review slices | Split oversized changes into chained PRs that protect review focus |
| comment-writer | PR feedback, issue replies, GitHub/Slack comments | Warm, direct collaboration tone; not sycophantic; not aggressive |
| work-unit-commits | Implementation, commit splitting, chained PRs | Plan commits as reviewable work units; keep tests and docs with the code that motivates them |
| go-testing | Go tests, teatest, golden files | Focused Go testing patterns. **Skip for verbum** — TS-only project. |
| skill-creator | New skills, agent instructions, AI usage patterns | LLM-first skill structure; valid frontmatter; trigger-first descriptions ≤ 250 chars |
| branch-pr | Creating, opening, preparing PRs | Issue-first checks; conventional commit titles |
| judgment-day | Dual review, adversarial review | Blind dual review, fix confirmed issues, then re-judge |
| issue-creation | GitHub issues, bug reports, feature requests | Issue-first checks before opening |
| ui-skills | Building interfaces with agents | Opinionated constraints for better interfaces |
| rams | Accessibility, visual design review | A11y + visual design review checklist |
| web-interface-guidelines | UI code review | Vercel Web Interface Guidelines compliance |
| simplify | Code review for reuse, quality, efficiency | Find duplicate logic, over-abstraction, dead code; fix issues found |
| fewer-permission-prompts | Reduce permission prompts | Add prioritized allowlist to project `.claude/settings.json` |
| claude-api | Anthropic SDK, prompt caching, model migrations | Build/optimize Claude API apps; include prompt caching by default |
| explain-blockers | Architectural blockers, "explain", "trade-offs" | Unpack blockers in plain language with What/Why/Fork/Instinct shape |
| sharpen-scope | Vague new work, /sdd-new, "let's build X" | Push back until Intent, First Reviewable Cut, Success Criterion, Riskiest Unknown are sharp |
| update-config | Hooks, permissions, env vars, settings.json | Configure Claude Code harness via settings.json; hooks for automation |
| keybindings-help | Customize keyboard shortcuts | Edit `~/.claude/keybindings.json` |
| init | Initialize CLAUDE.md | Generate codebase documentation file |
| review | Review a pull request | Standard PR review workflow |
| security-review | Security review of pending changes | Security-focused review of branch diff |
| loop | Recurring tasks, polling | `/loop 5m /foo` runs prompt on interval; omit interval for self-paced |
| schedule | Cron-scheduled remote agents | Routines that execute on cron; one-time scheduled runs supported |

## Plugin Skills

| Plugin | Skill | Purpose |
|---|---|---|
| engram | memory | **Always active.** Persistent memory protocol — save decisions, conventions, bugs, discoveries proactively |
| claudebeat | pick / settings | Configure notification sounds (not relevant to verbum dev) |

## Project Skills

(none — verbum has no project-level `.claude/skills/` configured yet)

## Project Conventions

| Source | Path | Relevance |
|---|---|---|
| User CLAUDE.md | `/Users/ivanmaierg/.claude/CLAUDE.md` | Applies to all projects — voseo Spanish, no AI commit attribution, pnpm preference (overridden for verbum: Bun is required by OpenTUI), brevity contract, response patterns |
| Project CLAUDE.md | `(none yet)` | Could be added at `/Users/ivanmaierg/Desktop/misc/verbum/CLAUDE.md` if project-specific instructions emerge |
| House rules | `docs/house-rules.md` | **The 12 enforceable code-review rules** — cite by number in PR comments. Designed for Go-port readiness. |

## Compact Rules — Skills Most Likely Relevant to verbum

When delegating to sub-agents that touch verbum source code or docs, prefer these compact rule sets:

### From `docs/house-rules.md` (highest priority)
- **R1**: Domain functions never throw — return `Result<T, E>`
- **R2**: No `class` outside `src/tui/` React components
- **R3**: Ports = interfaces with primitive/struct args, no callbacks
- **R4**: Zod stays in `src/api/` — domain imports plain TS types
- **R5**: Errors are discriminated unions with `kind` field
- **R6**: Branded IDs via single factory; no `as BookId` casts elsewhere
- **R7**: No conditional/mapped/template-literal types in domain or application
- **R8**: TUI business state in `useReducer`; `useState` for ephemeral UI only
- **R9**: No `useEffect` for business logic — Effect descriptors via top-level runner
- **R10**: Action names are past-tense facts (`ChapterLoaded`, `KeyPressed`)
- **R11**: No decorators — explicit higher-order functions
- **R12**: Async data functions return `Promise<Result<T, E>>`, never bare `Promise<T>`

### From `cognitive-doc-design`
- Lead with the decision, not the context
- Progressive disclosure: happy path first, edge cases after
- Tables and checklists over prose

### From `simplify`
- Reuse existing utilities before creating new ones
- Question every new abstraction
- Three similar lines is fine; the abstraction is premature

### From `work-unit-commits`
- Each commit reviewable on its own
- Tests + docs ship with the code that motivated them
- No "WIP" or "fix typo from X" commits in a clean history
