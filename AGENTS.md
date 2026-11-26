# Repository agent instructions

These instructions apply only to this repository and its descendants. Do not copy
project context into global Codex instructions, user configuration or global memory.

## Before every task

1. Read [MEMORY.md](MEMORY.md) first. Use its file map to inspect relevant code;
   avoid rescanning the whole repository for a narrowly scoped task.
2. Identify the Git root, branch, working tree and staged changes. Check upstream
   synchronization with a fetch when available; distinguish cached tracking state
   from a fresh remote check. If network/authentication is unavailable, report that
   limitation and continue independent local work when safe.
3. Review relevant recent commits and other developers' changes. Source code and
   current database/migration evidence override stale memory or historical docs.
4. Preserve all unrelated edits and staging state. Never overwrite, revert or
   discard another developer's work.

## During development

- Follow the existing React/TypeScript frontend and FastAPI/SQLAlchemy/PostgreSQL
  backend architecture. Keep HTTP, service, repository and import responsibilities
  in their existing modules. Avoid unrelated refactoring and new dependencies.
- Preserve the current Persian RTL Glass Studio interface, Latin digits, comparison
  result layout and input-driven shoe rotation unless the user requests a change.
- Check dependencies, compatibility, migration impact and potential regressions
  before editing. Validate changes with checks appropriate to their scope.
- Preserve exact shoe/generation/color identities, measurement provenance, import
  ownership and unknown values. Never invent inventory, current prices or metrics.
- Do not inspect or print private credential contents to populate documentation.
  Never commit `.env`, `.local/`, raw datasets, credentials or private backups.

## After every project-modifying task

Update **MEMORY.md before finishing**, including documentation-only tasks. Update
existing sections rather than appending an unlimited diary. Record relevant:

- Completed, changed or removed features and affected paths.
- Implementation/design decisions, schema/data/dependency changes and rationale.
- Bugs resolved or discovered, limitations, unfinished work and concrete next steps.
- Commands actually run and their actual results; separate historical verification
  from fresh checks. Never claim an unexecuted test passed.
- If interrupted, the exact resume point and pending checks or delivery steps.

Keep memory compact, deduplicated and current. Consolidate old work into the feature
and architecture sections; retain only a few recent significant changes. Distinguish
verified facts, assumptions, implemented/partial/planned work and recommendations.
Use Git history for detailed history. Store no secrets, credentials, tokens, private
personal information or actual visitor identifiers. Reference public Git history for
developer attribution rather than duplicating identities in memory.

## Git collaboration

- Do **not** automatically commit or push future tasks without explicit user
  authorization. Initialization authorization was limited to creating/updating and
  publishing these two memory files; it is not ongoing publication permission.
- When a commit is authorized, include the relevant MEMORY.md update in the same
  commit as the implementation. Stage only task-owned changes and preserve unrelated
  staging. Preserve the established primary author and the second collaborator's
  `Co-authored-by` trailer; obtain the exact existing attribution from recent Git
  commits, never invent identities or change global Git configuration.
- Fetch/check synchronization before publishing. Never force push, hard reset,
  rewrite history or perform other destructive Git operations without explicit
  authorization. Stop and report publication blockers; do not bypass protection.
- Reconcile both collaborators' valid memory changes against actual source state
  when resolving conflicts. Do not resolve MEMORY.md by blindly choosing one side.
- Verify the resulting remote branch after an authorized push.
