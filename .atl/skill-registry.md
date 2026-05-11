# Skill Registry — verbum

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

Last scanned: 2026-05-11
Sources scanned:
- `~/.claude/skills/` (13 user skills)
- `~/.cursor/skills/` (1 user skill)
- `~/.claude/plugins/cache/` (installed plugin skills)
- `~/.config/opencode/skills/`, `~/.gemini/skills/`, `~/.copilot/skills/` (empty or absent)
- `{project}/.claude/skills/`, `.gemini/skills/`, `.agent/skills/`, `skills/` (none in verbum)

Skipped per scan rules: `sdd-*`, `_shared`, `skill-registry`.

---

## User Skills

| Trigger | Skill | Path |
|---|---|---|
| Audit a deployed URL or local web project against Vercel's Agent Readability spec | agent-readability-inspector | `~/.claude/skills/agent-readability-inspector/SKILL.md` |
| Create PRs with issue-first checks | branch-pr | `~/.claude/skills/branch-pr/SKILL.md` |
| Split PRs over 400 lines, stacked PRs, review slices | chained-pr | `~/.claude/skills/chained-pr/SKILL.md` |
| Writing guides, READMEs, RFCs, onboarding, architecture, or review-facing docs | cognitive-doc-design | `~/.claude/skills/cognitive-doc-design/SKILL.md` |
| PR feedback, issue replies, reviews, Slack/GitHub comments | comment-writer | `~/.claude/skills/comment-writer/SKILL.md` |
| Unpack architectural blockers in plain language; "explain", "trade-offs" | explain-blockers | `~/.claude/skills/explain-blockers/SKILL.md` |
| Go tests, teatest, golden files | go-testing | `~/.claude/skills/go-testing/SKILL.md` (**skip for verbum** — TS-only) |
| Creating GitHub issues, bug reports, or feature requests | issue-creation | `~/.claude/skills/issue-creation/SKILL.md` |
| Judgment day, dual review, adversarial review, juzgar | judgment-day | `~/.claude/skills/judgment-day/SKILL.md` |
| Improve repo SEO, add topics/keywords, repo discoverability | repo-seo | `~/.claude/skills/repo-seo/SKILL.md` |
| Force precision before new work; auto-fires on /sdd-new and vague scope | sharpen-scope | `~/.claude/skills/sharpen-scope/SKILL.md` |
| Create new skills with valid frontmatter | skill-creator | `~/.claude/skills/skill-creator/SKILL.md` |
| Plan commits as reviewable work units; commit splitting | work-unit-commits | `~/.claude/skills/work-unit-commits/SKILL.md` |
| Build distinctive, production-grade frontend interfaces | frontend-design | `~/.claude/plugins/cache/claude-plugins-official/frontend-design/e30768372b41/skills/frontend-design/SKILL.md` |
| Persistent memory — save decisions, conventions, bugs proactively | engram:memory | `~/.claude/plugins/cache/engram/engram/0.1.0/skills/memory/SKILL.md` |
| Opinionated constraints for building UIs with agents (Tailwind + motion/react + Base UI) | ui-skills | `~/.cursor/skills/ui-skills/SKILL.md` |

## Built-in / harness-provided skills (no SKILL.md on disk)

These appear in `<available_skills>` but are not invokable via filesystem scan. Invoke via the `Skill` tool with the exact slug.

| Skill | Trigger |
|---|---|
| simplify | Review changed code for reuse, quality, efficiency; remove duplication / over-abstraction |
| rams | Accessibility and visual design review |
| web-interface-guidelines | Review UI code for Vercel Web Interface Guidelines compliance |
| review | Standard PR review workflow |
| security-review | Security review of pending branch changes |
| init | Initialize a CLAUDE.md file with codebase documentation |
| claude-api | Build / debug / optimize Claude API + Anthropic SDK apps; prompt caching |
| update-config | Configure Claude Code harness via settings.json — hooks, permissions, env vars |
| keybindings-help | Customize keyboard shortcuts in `~/.claude/keybindings.json` |
| fewer-permission-prompts | Add prioritized allowlist to project `.claude/settings.json` |
| loop | Run a prompt on a recurring interval or self-paced |
| schedule | Cron-scheduled remote agents |
| claudebeat:pick / claudebeat:settings | Configure notification sounds (not relevant to verbum dev) |

---

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### agent-readability-inspector
- Resolve target FIRST: URL or local project — never both implicitly.
- URL targets: WebFetch the URL plus `/llms.txt`, `/robots.txt`, `/sitemap.xml` only. No deep crawl.
- Local targets: read files only — no `pnpm dev`, no network, no builds.
- Group findings by category — Discovery / Structure / Context. Never lump.
- Each finding: `PASS`/`WARN`/`FAIL` + evidence (path or URL fragment + 1-line quote) + one-sentence imperative fix.
- Report only. Do NOT auto-edit files. The user decides what to apply.

### branch-pr
- Every PR MUST link an approved issue (`status:approved` label) — no exceptions.
- Every PR MUST have exactly one `type:*` label.
- Branch names MUST match `^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)\/[a-z0-9._-]+$`.
- Use conventional commits in PR commit messages.
- Run shellcheck on modified scripts before opening PR.
- Wait for automated checks to pass before merge.

### chained-pr
- Split PRs over 400 changed lines unless maintainer accepts `size:exception`.
- Each PR reviewable in ≤60 minutes; one deliverable work unit per PR.
- Every chained PR states start, end, prior deps, follow-up, and out-of-scope.
- Every child PR includes a dependency diagram marking the current PR with the pin emoji.
- Feature Branch Chain: draft/no-merge tracker PR; child #1 targets tracker, later children target immediate parent.
- Polluted diff = base bug — retarget or rebase until only the current work unit appears.
- Do NOT mix chain strategies after the user chooses one.

### cognitive-doc-design
- Lead with the answer — decision/action/outcome first, context after.
- Progressive disclosure: happy path first, then edges and references.
- Chunking: small grouped sections; flat lists stay short.
- Signposting: headings, callouts, summaries so readers know where they are.
- Recognition over recall: tables, checklists, examples, templates over remembered prose.
- Review empathy: design so reviewers can verify intent without reconstructing the story.

### comment-writer
- Be useful fast — start with the actionable point, no PR recap.
- Warm and direct, not corporate-bot.
- 1–3 short paragraphs or a tight bullet list. Explain WHY when asking for a change.
- No pile-ons — comment on the highest-value issue, not every preference.
- Match thread language; in Spanish, use Rioplatense voseo (`podés`, `tenés`, `fijate`, `dale`).
- No em dashes. Use commas, periods, or parentheses.

### explain-blockers
- One blocker = one H3 section. Never merge blockers into one paragraph.
- Each section follows the Four-Part Shape: What → Why it matters → The fork → My instinct (optional).
- ONE closing question at the very end — not per-blocker.
- Concepts before code — no code blocks; reference paths if load-bearing.
- Pro/Con MUST be a named consequence ("requires a migration later"), not vague adjectives ("more flexible").
- Plain language is not baby talk. Don't condescend.

### issue-creation
- Blank issues are disabled — MUST use a template (bug report or feature request).
- Every issue auto-gets `status:needs-review`; PR is blocked until maintainer adds `status:approved`.
- Search for duplicates BEFORE filing.
- Questions go to Discussions, not Issues.
- Fill ALL required template fields and tick pre-flight checkboxes.

### judgment-day
- Launch TWO blind judges in parallel with identical target and criteria. Never review the code yourself.
- Resolve project skills FIRST and inject the same `Project Standards` block into both judges and any fix prompts.
- Wait for BOTH judges before synthesis — never accept a partial verdict.
- `WARNING (real)` only if normal intended use can trigger it; otherwise downgrade to `WARNING (theoretical)`/INFO.
- Ask before fixing Round 1 confirmed issues. After any fix, immediately re-launch both judges before commit/push/done.
- Terminal states: `JUDGMENT: APPROVED` or `JUDGMENT: ESCALATED`. After 2 fix iterations, ask whether to continue.

### repo-seo
- Three surfaces — GitHub (description + topics + README), package registry, Google/external. Hit all three or leave reach on the table.
- Description recipe: `<verb> <what it does> — <form factor> <stack/architecture>`. Max 350 chars, target ~120.
- GitHub topics: 12–18, lowercase, hyphen-separated; mix domain + form factor + stack + architecture + audience.
- Don't pad with `code`, `software`, `project`, `tool`, `awesome` — they don't rank.
- README header: ONE H1, subtitle as blockquote, 5–6 badges max, keyword-rich opening paragraph.
- Always propose first, apply on user approval — these are externally-visible changes.
- Don't restructure the README body — only the header — unless asked.

### sharpen-scope
- Every question carries 2–3 concrete candidate answers grounded in project context. Never ask "what do you want?" raw.
- ONE question at a time, then STOP and wait.
- Name vagueness as vagueness — call out placeholders like "next step", "cleaner", "polish".
- Refuse to delegate to `sdd-explore` or downstream coding until the Four Sharps are answered concretely.
- The Four Sharps: Intent (problem in one sentence) → First Reviewable Cut (smallest end-to-end slice + what's OUT) → Success Criterion (one observable behavior) → Riskiest Unknown.

### skill-creator
- A skill is a runtime instruction contract for an LLM, not human documentation.
- Frontmatter: `name`, `description` starts with `Trigger: <words>. <what>.`, license, metadata.
- Do NOT add a `Keywords` section — preserve trigger words in `description`.
- Body length: target 180–450 tokens, hard max 1000. Move overflow to `assets/` or `references/`.
- References point to LOCAL files only.
- If `docs/skill-style-guide.md` exists, apply it before fallback rules.

### work-unit-commits
- Commit by deliverable behavior, fix, migration, or docs unit — NOT by file type.
- Tests ship with the behavior they verify, in the same commit.
- Docs ship with the user-visible change they explain.
- Each commit reviewable on its own; repo still makes sense after applying only that commit.
- Each commit a candidate chained PR if the change grows.
- If SDD forecasts >400 lines, group commits into chained-PR slices BEFORE implementation.

### frontend-design
- Pick an extreme aesthetic and execute with precision (brutalist, editorial, organic, retro-futuristic, etc.) — NEVER generic "AI slop".
- Avoid Inter / Roboto / Arial / system fonts and purple-gradient-on-white. Pair a distinctive display font with a refined body font.
- Use CSS variables for color consistency. Dominant colors with sharp accents outperform timid even palettes.
- Animations: high-impact moments (staggered page load beats scattered micro-interactions). CSS-only for HTML; `motion/react` for React.
- Compose spatially: asymmetry, overlap, diagonal flow, controlled density or generous negative space.
- Match implementation complexity to the aesthetic — maximalism needs elaborate code; minimalism needs restraint.

### engram:memory
- ALWAYS ACTIVE. Call `mem_save` IMMEDIATELY after: decisions, conventions, bug fixes, discoveries, gotchas, user confirmations/rejections, preferences.
- `mem_save` content shape: **What** (one sentence) + **Why** (motivation) + **Where** (paths) + **Learned** (gotchas).
- Topic key for evolving topics: stable key like `architecture/auth-model`. Same topic → same key (upsert).
- `capture_prompt: false` ONLY for automated artifacts (SDD phases, registry, init reports). Default true for human/proactive saves.
- Search before assuming context: `mem_context` for recent sessions, `mem_search` for keywords, `mem_get_observation` for full content.
- Before saying "done"/"listo": call `mem_session_summary` with Goal / Discoveries / Accomplished / Next Steps / Relevant Files.

### ui-skills
- Tailwind CSS defaults unless custom exists or is explicitly requested.
- `motion/react` for JS animation; `tw-animate-css` for entrances and micro-animations; `cn` (clsx + tailwind-merge) for class logic.
- MUST use accessible primitives (Base UI / React Aria / Radix) — never rebuild keyboard/focus behavior by hand.
- NEVER mix primitive systems within one interaction surface.
- `aria-label` on icon-only buttons. `AlertDialog` for destructive/irreversible actions. Errors next to the action.
- `h-dvh` not `h-screen`. Respect `safe-area-inset` for fixed elements.
- Animation: only `transform` and `opacity`; never layout (`width/height/top/left/margin/padding`); ≤200ms for interaction feedback; respect `prefers-reduced-motion`.
- NEVER add animation unless explicitly requested.

---

## Project Conventions

| File | Path | Notes |
|---|---|---|
| User CLAUDE.md | `/Users/ivanmaierg/.claude/CLAUDE.md` | Applies to all projects — Rioplatense Spanish (voseo), no AI commit attribution, RTK tool usage, brevity contract, one-question-at-a-time, no `cat`/`grep`/`find`/`sed`/`ls` (use `bat`/`rg`/`fd`/`sd`/`eza`) |
| RTK | `/Users/ivanmaierg/.claude/RTK.md` | Rust Token Killer — token-optimized CLI proxy; auto-rewrites commands via Claude Code hook |
| House Rules | `/Users/ivanmaierg/Desktop/misc/verbum/docs/house-rules.md` | **12 enforceable code-review rules** — cite by number. Designed for Go-port readiness. |

### Compact Rules — House Rules (R1–R12)

Highest-priority project constraints. Inject into ANY sub-agent that touches `src/` or `tests/`.

- **R1**: Domain functions never throw — return `Result<T, E>`. Throwing in `src/domain/` is a review-blocker.
- **R2**: No `class` outside React components in `src/tui/`. Use cases, parsers, repos, value objects, adapters are functions or plain object factories.
- **R3**: Ports = interfaces with primitive/struct args, no callbacks. No event emitters, observables, or streaming via callbacks.
- **R4**: Zod stays in `src/api/` — domain imports plain TS types. Validation lives at the boundary.
- **R5**: Errors are discriminated unions with `kind` field. Exhaustive renderers per error variant.
- **R6**: Branded IDs via a single factory; no `as BookId` casts elsewhere.
- **R7**: No conditional/mapped/template-literal types in domain or application. Keep types Go-portable.
- **R8**: TUI business state in `useReducer`; `useState` for ephemeral UI only.
- **R9**: No `useEffect` for business logic — Effect descriptors via top-level runner.
- **R10**: Action names are past-tense facts (`ChapterLoaded`, `KeyPressed`, `VerseRequested`).
- **R11**: No decorators — explicit higher-order functions only.
- **R12**: Async data functions return `Promise<Result<T, E>>`, never bare `Promise<T>`.

### Compact Rules — User CLAUDE.md (verbum-relevant excerpts)

- Default to short answers. Start with minimum useful response, expand only when asked.
- ONE question at a time. After asking, STOP and wait.
- No option menus / exhaustive lists unless there's a real fork with meaningful tradeoffs.
- Never agree with user claims without verification. Verify, then state.
- If user is wrong: explain WHY with evidence; show the correct way.
- Use voseo Spanish (`podés`, `tenés`, `dale`) when conversing in Spanish; warm natural English otherwise.
- Never add `Co-Authored-By` or AI attribution to commits. Conventional commits only.
- Never build after changes (no `bun build`).
- Tools: prefer `bat`/`rg`/`fd`/`sd`/`eza` over `cat`/`grep`/`find`/`sed`/`ls`.
- Verbum-specific: English is the preferred conversation language for this project (per 2026-05-11 confirmation).

---

## Notes for sub-agents

- Receive these compact rules pre-digested in your launch prompt as `## Project Standards (auto-resolved)`.
- Do NOT read this registry yourself.
- Cite house rules by number (R1–R12) in any code review or implementation rationale.
- For verbum, `go-testing` is irrelevant — TypeScript / Bun project, no Go code.
