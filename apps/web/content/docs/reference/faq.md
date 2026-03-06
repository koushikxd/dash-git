---
title: FAQ
description: Common questions and troubleshooting for dash.
---

Quick answers.

## Errors

### "dash" runs the system shell instead of the CLI

Many Linux systems (Debian, Ubuntu) have `/usr/bin/dash` (the Debian Almquist Shell) installed. If your npm bin directory is lower in PATH priority, the system shell runs instead.

**Solution:** Use `dash-cli` instead:

```bash
dash-cli setup
dash-cli commit
dash-cli pr
```

Both `dash` and `dash-cli` are provided as binary names—use whichever works on your system.

**Alternative:** Fix your PATH to prioritize npm globals:

```bash
# Add to your .bashrc or .zshrc
export PATH="$(npm bin -g):$PATH"
```

### "Please set your Groq API key"

```bash
dash config set GROQ_API_KEY=gsk_your_key_here
```

Get your key at [console.groq.com/keys](https://console.groq.com/keys).

### "No staged changes found"

```bash
git add .
dash commit
```

Or:

```bash
dash commit --all
```

### "GitHub CLI (gh) not found"

Install from [cli.github.com](https://cli.github.com/), then:

```bash
gh auth login
dash setup
```

Don't want gh? Disable it:

```bash
dash config set gh_enabled=false
```

### "Request too large" (413)

Exclude files:

```bash
dash commit --exclude dist/ --exclude node_modules/
```

Or commit in smaller batches.

### "No commit messages were generated"

- Check your API key: `dash config get GROQ_API_KEY`
- Check staged changes: `git status`
- Check internet connection

## Questions

### Why Groq?

Fast, cheap, reliable. Results in seconds, not minutes.

### Does dash send my code?

Only your git diff or commit log, not your full codebase. For large diffs, it sends a summary.

### How much does it cost?

Groq pricing: [groq.com/pricing](https://groq.com/pricing). The default model is cheap.

### Large diffs?

Dash auto-handles them. Creates summaries, includes code snippets, never hits limits.

### Git hooks?

```bash
dash hook install
```

Then `git commit` works normally. Dash generates the message.

### CLI vs hook mode?

- **CLI** (`dash commit`) - Interactive, review before commit
- **Hook** (`dash hook install`) - Auto-generates, opens in editor

### Conventional commits?

```bash
dash commit --type conventional
```

Or set in config:

```bash
dash config set type=conventional
```

### Exclude files?

```bash
dash commit --exclude dist/ --exclude package-lock.json
```

### Custom prompts?

Create a `.dash` folder in your repository with these files:

- `.dash/commit.md` - Custom commit message prompt
- `.dash/pr.md` - Custom PR description prompt

When these files exist, dash uses them instead of the built-in prompts.

**Example `.dash/commit.md`:**

```markdown
# Commit Guidelines
Use present tense. Include ticket numbers.
Keep under 70 characters.
```

**Monorepo support:** Dash searches up the directory tree to find `.dash` prompts. You can have global rules at the root and package-specific rules in subdirectories. When you run `dash commit`, it uses the nearest `.dash` folder it finds.

### Works in monorepos?

Yes! Dash searches up the directory tree for `.dash` prompts, so you can have:

```
monorepo/
├── .dash/commit.md              # Global rules for all packages
└── packages/
    ├── api/.dash/commit.md      # API-specific rules
    └── web/.dash/commit.md      # Web-specific rules
```

Run `dash commit` anywhere, and it uses the nearest `.dash` folder.

### GitHub required?

Only for `dash pr` and `dash issue` commands. `dash commit` and `dash hook` work without GitHub CLI.

### Update dash?

```bash
npm update -g dash-git
dash --version
```

## Still stuck?

- [Installation](/docs/installation)
- [Usage](/docs/usage)
- [Configuration](/docs/configuration)
- [GitHub Issues](https://github.com/koushikxd/dash-git/issues)
