---
title: Usage
description: Use dash's commands and features.
---

Everything you can do with dash.

## Commit messages

### Quick commit (recommended)

```bash
dash
```

The fastest way to commit. Simply run `dash` and it will:
1. Ask whether to stage all changed files or select files manually
2. Generate a commit message
3. Let you edit or accept it
4. Ask if you want to push to remote

Press **Enter** to push, **Esc** to skip pushing.

"Stage all changed files" is selected by default. Switch to manual mode with the arrow keys, then use **Space** to pick files and **Enter** to submit.

### Basic use

```bash
git add .
dash commit
```

Dash shows you a message. Use it, edit it, or cancel. After committing, prompts to push to remote.

Press **Enter** to push, **Esc** to skip pushing.

If no files are staged, dash asks whether to stage all changes or open a manual file picker first.

For larger diffs, dash may generate a multi-line commit message with a standard `type: subject` first line and `- ` bullets for each major change.

### Commit alias

```bash
dash c
```

Short alias for `dash commit`.

### Extra context for AI

```bash
dash commit -m "chore: hide testimonials"
```

Passes your note to the AI as extra context so it can generate a better final commit message for the selected diff.

### Stage everything

```bash
dash commit --all
```

Stages all changed files before committing, then prompts to push.

### Multiple options

```bash
dash commit --generate 3
```

Generates 3 messages to choose from. Uses more tokens.

### Conventional commits

```bash
dash commit --type conventional
```

Follows the [Conventional Commits](https://conventionalcommits.org/) format.

### Exclude files

```bash
dash commit --exclude package-lock.json --exclude dist/
```

Ignores certain files when analyzing changes.

## Pull requests

Requires [GitHub CLI](https://cli.github.com/) installed and authenticated.

### Create PR

```bash
dash pr
```

Analyzes your commits, generates title and description, creates the PR. If a PR exists, you can edit it. After creation, prompts to open the PR in your browser.

**Options:**

- `--draft` or `-d` - Create as draft PR
- `--base <branch>` or `-b` - Target branch (defaults to main/master)
- `--issue <number>` or `-i` - Link to an issue (adds "Closes #X")
- `--repo <owner/repo>` or `-R` - Target repository for fork PRs

```bash
dash pr --draft
dash pr --base develop
dash pr --issue 123
dash pr --repo owner/repo
```

When working on a fork, dash detects it and asks if you want to create the PR on the upstream repository.

### List PRs

```bash
dash pr list
```

### View current PR

```bash
dash pr view
```

### Merge PR

```bash
dash pr merge
```

Prompts to select merge method. Or specify directly:

- `--squash` or `-s` - Squash and merge (recommended)
- `--merge` or `-m` - Create a merge commit
- `--rebase` or `-r` - Rebase and merge

```bash
dash pr merge --squash
```

## Issues

```bash
dash issue list
```

**Options:**

- `--state <state>` or `-s` - Filter by state: open, closed, or all (default: open)
- `--limit <number>` or `-l` - Number of issues to show (default: 20)

```bash
dash issue list --state all --limit 10
```

## Model selection

Change the AI model used for generation.

### Interactive selection

```bash
dash model
```

Opens a prompt to select from popular models or enter a custom one. Shows a link to [Groq's model docs](https://console.groq.com/docs/models) for reference.

### List models

```bash
dash model list
```

Shows popular models with your current selection highlighted.

### Set directly

```bash
dash model set openai/gpt-oss-120b
```

Skip the prompt and set a model directly.

## Git hooks

Auto-generate messages when you run `git commit`.

### Install

```bash
dash hook install
```

### Use

```bash
git add .
git commit
```

Dash generates the message, Git opens your editor to review it. Save and close to commit.

Want your own message? Use `git commit -m "message"` as usual.

### Uninstall

```bash
dash hook uninstall
```

## Custom prompts

Create a `.dash` folder with custom rules:

```bash
mkdir .dash
```

**`.dash/commit.md`** - Commit message guidelines:

```markdown
Use present tense. Include ticket numbers.
```

**`.dash/pr.md`** - PR description guidelines:

```markdown
Include testing steps and ticket links.
```

When these files exist, dash uses them instead of the default prompts.

### Monorepo support

Dash searches up the directory tree, so you can have different prompts per package:

```
monorepo/
├── .dash/commit.md         # Global rules
└── packages/
    ├── api/.dash/commit.md # API-specific rules
    └── web/.dash/commit.md # Web-specific rules
```

Run `dash commit` in any package, and it uses the nearest `.dash` prompts.

## Branch summary

Get a comprehensive overview of changes in your current branch.

### Basic use

```bash
dash summary
```

Compares your current branch against the default branch (main/master) and generates:
- Statistics (files changed, additions, deletions)
- AI-generated summary of what happened
- Detailed list of changes in bullet points

### Compare with specific branch

```bash
dash summary develop
```

Compares your current branch against the specified target branch.

## Large diffs

Dash handles big changes automatically. It summarizes stats and includes code snippets so you never hit API limits.

## Command reference

```bash
dash commit [-g <n>] [-x <files>] [-a] [-t <type>] [-m <context>]
dash pr [create|list|view|merge] [-b <branch>] [-d] [-i <issue>] [-R <repo>]
dash issue list [-s <state>] [-l <n>]
dash model [list|set <model>]
dash hook <install|uninstall>
dash summary [branch]
dash config <get|set> <key=value>
dash setup
```

## Quick examples

```bash
# Quick commit with interactive staging and push prompt
dash

# Commit staged files, or choose staging interactively if nothing is staged
dash commit

# Same as dash commit
dash c

# Give the AI extra context for the final message
dash commit -m "chore: hide testimonials"

# Generate 3 commit message options
dash commit --all --generate 3

# Conventional commits with file exclusions
dash commit --type conventional --exclude dist/

# Create draft PR on develop branch
dash pr --draft --base develop

# Create PR linked to issue on upstream repo
dash pr --issue 42 --repo upstream/project

# Merge PR with squash
dash pr merge --squash

# List all issues (closed and open)
dash issue list --state all --limit 10

# Interactive model selection
dash model

# Set specific model
dash model set openai/gpt-oss-120b

# Install git hook for auto-generation
dash hook install

# Generate branch summary against main
dash summary

# Generate branch summary against develop
dash summary develop
```

Need more details? Check [Configuration](/docs/configuration).
