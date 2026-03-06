---
title: Installation
description: Install and set up dash.
---

Install dash in under a minute.

## What you need

- **Node.js** 18+
- **Git** (you probably have this)
- **Groq API key** - Free at [console.groq.com/keys](https://console.groq.com/keys)
- **GitHub CLI** - Optional, only for PRs and issues. Get it at [cli.github.com](https://cli.github.com/)

## Install

```bash
npm install -g dash-git
```

Done. Now run:

```bash
dash setup
```

This checks your setup and helps configure GitHub CLI if you have it.

> **Linux users:** If you have the system shell `dash` installed (common on Debian/Ubuntu), use `dash-cli` instead of `dash` for all commands. Both work identically.

## Add your API key

Get your free API key from [Groq Console](https://console.groq.com/keys), then:

```bash
dash config set GROQ_API_KEY=gsk_your_key_here
```

Or use an environment variable:

```bash
export GROQ_API_KEY=gsk_your_key_here
```

## GitHub CLI (optional)

If you want to use `dash pr` or `dash issue` commands, authenticate GitHub CLI:

```bash
gh auth login
```

Skip this if you only want commit message generation.

## Test it

```bash
dash --version
```

If you see a version number, you're ready.

```bash
git add .
dash commit
```

## Update dash

```bash
npm update -g dash-git
```

**Need help?** Check the [FAQ](/docs/reference/faq) or [open an issue](https://github.com/koushikxd/dash-git/issues).
