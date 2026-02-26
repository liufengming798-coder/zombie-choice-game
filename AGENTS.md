# AGENTS.md

## Goal
Deploy this static project to GitHub Pages quickly and repeatably.

## Preferred Deploy Method
Use the one-click script in the project root:

```bash
bash ./deploy_github_pages.sh
```

## What The Script Does
1. Checks `git` and `gh` availability.
2. Checks GitHub CLI login status.
3. Ensures branch is `main`.
4. Creates GitHub repo if missing (`public`).
5. Commits local changes (if any).
6. Pushes to `origin/main`.
7. Enables GitHub Pages (`main` + `/`).
8. Prints final public URL.

## Defaults
- Repo name: current folder name.
- GitHub user: from `gh api user`.
- Override with env vars:

```bash
GITHUB_USER=your_name REPO_NAME=your_repo bash ./deploy_github_pages.sh
```

## Notes For Codex
- For deployment requests, run the script first instead of manual multi-step commands.
- If script fails, report exact failing step and fix the minimal issue.
- Keep changes non-destructive.
