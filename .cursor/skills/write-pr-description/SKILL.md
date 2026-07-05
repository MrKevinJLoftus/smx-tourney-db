---
name: write-pr-description
description: >-
  Draft pull request titles and descriptions by comparing the current branch to
  the repo default branch. Use when the user asks for a PR description, PR body,
  pull request summary, or help opening a PR without creating one yet.
---

# Write PR Description

Draft a PR title and description from real branch diffs. Do not create or push the PR unless the user explicitly asks.

## 1. Resolve the default branch

Use the first method that works:

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
git symbolic-ref refs/remotes/origin/HEAD --short
```

Strip a leading `origin/` from the result. Fall back to `main`, then `master`.

Set `BASE` to that branch name.

## 2. Gather changes

Run these in parallel (replace `BASE`):

```bash
git status
git branch --show-current
git log --oneline BASE...HEAD
git diff --stat BASE...HEAD
git diff BASE...HEAD
```

If `BASE...HEAD` is empty but the working tree is dirty, the branch may not be ahead of default yet — also run `git diff` and `git diff --cached` and include uncommitted work in the summary.

If the current branch **is** the default branch, describe uncommitted and staged changes against `HEAD` instead.

## 3. Read the PR template

If present, read `.github/pull_request_template.md` (or `.github/PULL_REQUEST_TEMPLATE.md`) and match its sections. If none exists, use:

```markdown
## Summary

## Test plan

- [ ] Tested locally
```

## 4. Analyze the diff

Review **all** commits in `BASE...HEAD`, not only the latest. From the diff, identify:

- What changed and why (user-facing outcome, not a file list)
- API, schema, or config changes worth calling out
- Migrations or manual setup steps
- Risky areas or edge cases

Keep prose proportional to change size. A small fix gets a short summary; a multi-area feature gets a few focused bullets.

## 5. Write the output

Return:

1. **Suggested title** — imperative, under ~72 characters, focused on the main outcome
2. **PR description** — filled template in a single fenced markdown block, ready to paste into GitHub

Title and summary should reflect the full branch diff. Do not list every changed file unless the user asked for a changelog-style breakdown.

### Test plan guidance

- Check off "Tested locally" only when the user confirmed testing or the conversation makes it clear
- Add specific checks only when the diff warrants them (new endpoints, UI flows, migrations, etc.)
- Leave the checkbox unchecked with concrete suggested checks when testing was not discussed

## 6. Optional: open the PR

Only if the user explicitly asks to create the PR:

```bash
git push -u origin HEAD
gh pr create --title "TITLE" --body "$(cat <<'EOF'
BODY HERE
EOF
)"
```

Return the PR URL when created.
