# Dash

AI-powered Git CLI. Generate commit messages, create PRs, manage issues—all from your terminal.

## Install

```bash
npm install -g dash-git
```

> **Linux users:** If `dash` runs the system shell instead of this CLI, use `dash-cli` instead.

## Setup

Get your free API key from [console.groq.com/keys](https://console.groq.com/keys):

```bash
dash config set GROQ_API_KEY=gsk_your_key_here
```

Or use an environment variable:

```bash
export GROQ_API_KEY=gsk_your_key_here
```

## Quick start

```bash
git add .
dash commit

dash pr
```

## Commands

### Commit

```bash
dash commit

dash commit --all
dash commit --generate 3
dash commit --exclude dist/
dash commit --type conventional
```

### Pull requests

Requires [GitHub CLI](https://cli.github.com/).

```bash
dash pr
dash pr --draft
dash pr --base develop

dash pr list
dash pr view
dash pr merge --squash
```

### Issues

```bash
dash issue list
dash issue list --state all
dash issue list --limit 10
```

### Model

```bash
dash model
dash model list
dash model set llama-3.3-70b-versatile
```

Change AI models interactively or directly. See all models at [console.groq.com/docs/models](https://console.groq.com/docs/models).

### Git hook

```bash
dash hook install
dash hook uninstall
```

Then `git commit` auto-generates messages.

## Configuration

Config lives in `~/.dash`:

```bash
dash config set <key>=<value>
dash config get <key>
```

| Option       | Default            | Description          |
| ------------ | ------------------ | -------------------- |
| GROQ_API_KEY | -                  | API key (required)   |
| model        | openai/gpt-oss-20b | AI model             |
| generate     | 1                  | Messages to generate |
| type         | -                  | Use `conventional`   |
| max-length   | 100                | Max message length   |
| locale       | en                 | Message language     |

Examples:

```bash
dash config set model=llama-3.3-70b-versatile
dash config set type=conventional max-length=72
```

## Custom prompts

Create a `.dash` folder in your repo with custom guidelines:

**`.dash/commit.md`** - Commit rules:

```markdown
Use present tense. Include ticket numbers.
```

**`.dash/pr.md`** - PR rules:

```markdown
Include testing steps and related tickets.
```

Dash uses these instead of default prompts. Works with monorepos—searches up the tree to find the nearest `.dash` folder.

## Documentation

Full docs at [koushikxd.github.io/dash-git](https://koushikxd.github.io/dash-git)

## Requirements

- Node.js 18+
- Git
- GitHub CLI (for PR/issue commands)

## Acknowledgments

Inspired by [noto](https://github.com/snelusha/noto) by Sithija Nelusha Silva.

## License

MIT
