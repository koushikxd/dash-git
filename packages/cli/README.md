# Dash CLI

AI-powered Git CLI for commit messages, PRs, and GitHub workflows.

## Install

```bash
npm install -g dash-git
```

Then run:

```bash
dash setup
```

> **Note:** If you have the system shell `dash` installed (common on Debian/Ubuntu), use `dash-cli` instead of `dash` for all commands.

## Requirements

- **Node.js** 18+
- **Git**
- **Groq API Key** from [console.groq.com/keys](https://console.groq.com/keys)
- **GitHub CLI** (optional) - for PR/issue commands. Get it at [cli.github.com](https://cli.github.com/)

## Quick start

```bash
dash config set GROQ_API_KEY=gsk_your_key_here

dash setup

git add .
dash commit

dash pr
```

## Commands

### `dash commit`

```bash
dash commit [-g <n>] [-x <files>] [-a] [-t <type>]
```

| Flag                    | Description                  |
| ----------------------- | ---------------------------- |
| `-g, --generate <n>`    | Generate n messages (max: 5) |
| `-x, --exclude <files>` | Exclude files                |
| `-a, --all`             | Stage all tracked files      |
| `-t, --type <type>`     | Use `conventional` format    |

Examples:

```bash
dash commit
dash commit --all
dash commit --exclude dist/ --generate 3
dash commit --type conventional
```

### `dash pr`

```bash
dash pr [create|list|view|merge] [flags]
```

| Subcommand | Description      |
| ---------- | ---------------- |
| `create`   | Create/edit PR   |
| `list`     | List open PRs    |
| `view`     | View current PR  |
| `merge`    | Merge current PR |

**Create flags:**

| Flag                  | Description     |
| --------------------- | --------------- |
| `-b, --base <branch>` | Base branch     |
| `-d, --draft`         | Create as draft |

**Merge flags:**

| Flag           | Description  |
| -------------- | ------------ |
| `-s, --squash` | Squash merge |
| `-m, --merge`  | Merge commit |
| `-r, --rebase` | Rebase merge |

Examples:

```bash
dash pr
dash pr --draft --base develop
dash pr list
dash pr merge --squash
```

### `dash issue`

```bash
dash issue list [-s <state>] [-l <n>]
```

| Flag                  | Description              |
| --------------------- | ------------------------ |
| `-s, --state <state>` | open, closed, all        |
| `-l, --limit <n>`     | Max issues (default: 20) |

Examples:

```bash
dash issue list
dash issue list --state all --limit 10
```

### `dash config`

```bash
dash config <get|set> <key=value...>
```

Examples:

```bash
dash config set GROQ_API_KEY=gsk_xxx
dash config set model=llama-3.3-70b-versatile
dash config get GROQ_API_KEY model
```

### `dash hook`

```bash
dash hook <install|uninstall>
```

Installs git hook for auto-message generation.

### `dash setup`

```bash
dash setup
```

Checks dependencies and configures GitHub CLI integration.

## Configuration

Config stored in `~/.dash`:

| Option         | Default            | Description        |
| -------------- | ------------------ | ------------------ |
| `GROQ_API_KEY` | -                  | API key (required) |
| `model`        | openai/gpt-oss-20b | AI model           |
| `generate`     | 1                  | Commit suggestions |
| `type`         | -                  | Use `conventional` |
| `max-length`   | 100                | Max message length |
| `locale`       | en                 | Message language   |
| `timeout`      | 10000              | API timeout (ms)   |
| `gh_enabled`   | true               | Enable gh features |

## Custom prompts

Create a `.dash` folder in your repository:

- `.dash/commit.md` - Overrides commit prompt
- `.dash/pr.md` - Overrides PR prompt

When these files exist, dash uses them instead of the built-in prompts.

**Monorepo support:** Dash searches up the directory tree, so you can have:

```
monorepo/
├── .dash/commit.md              # Root rules
└── packages/
    ├── api/.dash/commit.md      # API rules
    └── web/.dash/commit.md      # Web rules
```

Each package can have its own prompts.

## Environment variables

| Variable       | Description |
| -------------- | ----------- |
| `GROQ_API_KEY` | API key     |
| `HTTPS_PROXY`  | HTTP proxy  |

## GitHub CLI

Requires gh:

- `dash pr`
- `dash issue`

Works without gh:

- `dash commit`
- `dash hook`
- `dash config`
- `dash setup`

## Troubleshooting

### "dash" runs the system shell instead of the CLI

Many Linux systems (Debian, Ubuntu, etc.) have `/usr/bin/dash` (the Debian Almquist Shell) installed. If your npm bin directory is lower in PATH priority, the system shell runs instead.

**Solution:** Use `dash-cli` instead of `dash`:

```bash
dash-cli setup
dash-cli commit
dash-cli pr
```

Both `dash` and `dash-cli` are provided as binary names. Use whichever works on your system.

**Alternative:** Fix your PATH to prioritize npm globals:

```bash
# Check where dash resolves to
which dash

# Check npm global bin location
npm bin -g

# Add npm bin to PATH (in .bashrc/.zshrc)
export PATH="$(npm bin -g):$PATH"
```

## Development

```bash
git clone https://github.com/koushikxd/dash-git.git
cd dash/packages/cli

pnpm install
pnpm build
pnpm dev
pnpm test
```

## Structure

```
packages/cli/
├── src/
│   ├── commands/      # Command implementations
│   ├── utils/         # Git, config, API helpers
│   ├── errors.ts
│   └── index.ts
├── tests/
└── dist/
```

## Contributing

1. Fork it
2. Create a feature branch
3. Make changes
4. Run tests: `pnpm test`
5. Use dash to commit: `dash commit`
6. Use dash for PR: `dash pr`

## Acknowledgments

Inspired by [noto](https://github.com/snelusha/noto) by Sithija Nelusha Silva.

## License

MIT
