---
name: github-project-management
description: Use when planning and tracking work with GitHub Issues, Projects, milestones, labels, sprints. Triggers on GitHub Issues, Projects, milestone, label, sprint, kanban, roadmap, epic, backlog, gh issue, gh project.
---

# GitHub Project Management

GitHub project: `cli/cli` (`gh` CLI for Issues/Projects automation)

## When to Use
Use ONLY for GitHub-based project management — Issues, Projects v2 boards, milestones, labels, sprints/iterations for Telegram Mini App / Next.js projects.

## Workflow
1. Issues: `gh issue create --title "feat: ..." --body "context / acceptance criteria" --label "type:feat,area:miniapp" --milestone "v1.0"`; link PRs with `Fixes #123`; use tasklists `- [ ]` for subtasks.
2. Labels: `type:feat|fix|chore`, `area:frontend|backend|bot`, `priority:P0-P3`, `status:blocked|needs-review`; create via `gh label create`.
3. Milestones: one per release `v0.1`, `v1.0` with due date — `gh api repos/{owner}/{repo}/milestones -f title="v1.0" -f due_on="2026-11-01T00:00:00Z"`; close only when all P0/P1 issues done.
4. Projects v2: kanban `Backlog > Ready > In Progress > In Review > Done`; add items `gh project item-add <project-number> --owner <org> --url <issue-url>`; set `Status`, `Priority`, `Sprint` custom fields; triage weekly.
5. Verify: `gh issue list --milestone "v1.0" --state open`, `gh project view`, board empty for milestone before release, no unlabeled P0 open.

## Anti-Patterns
- Vague issues without acceptance criteria or repro steps.
- Using Projects v1 classic boards (deprecated) instead of Projects v2.
- Milestones as epics — use parent/ sub-issues (`gh issue develop`) or `Epic: #` tracking issue instead.
- Closing issues manually without linked PR `Fixes #` traceability.

## Reference
- Repo: https://github.com/cli/cli
- Docs: https://docs.github.com/en/issues, https://docs.github.com/en/issues/planning-and-tracking-with-projects
