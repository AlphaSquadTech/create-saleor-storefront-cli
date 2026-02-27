# @alphasquad/create-storefront-cli

A CLI tool for scaffolding Saleor storefronts from templates.

## Prerequisites

- Node.js >= 18
- Git
- SSH keys configured for GitHub (default) **or** a GitHub Personal Access Token (PAT) with repo access

## Quick start

```bash
npx @alphasquad/create-storefront-cli --name my-store
```

The CLI will prompt you to select a template:

```
Select a template:

  1) basic
  2) standard
  3) advanced

Enter choice (1-3):
```

Or install globally:

```bash
npm i -g @alphasquad/create-storefront-cli
create-storefront --name my-store
```

## Options

| Flag             | Required | Description                                                    |
| ---------------- | -------- | -------------------------------------------------------------- |
| `--name`         | Yes      | Tenant / directory name                                        |
| `--template`     | No       | Template variant: `basic`, `standard`, `advanced` (prompts if omitted) |
| `--no-ssh`       | No       | Disable SSH and use HTTPS + PAT instead                        |
| `--pat`          | No       | GitHub Personal Access Token (implies `--no-ssh`)              |
| `--settings`     | No       | Path to `settings.json` (default: `./settings.json`)           |
| `--template-url` | No       | Custom Git URL (overrides `--template`)                        |
| `--help`         | No       | Show help message                                              |

## Authentication

SSH is the default. The CLI uses your SSH agent and keys (`~/.ssh/`) to clone repos — no token needed.

To fall back to HTTPS + PAT, pass `--no-ssh` or `--pat <token>`, or set the `GITHUB_PAT` environment variable.

**PAT resolution order** (when using HTTPS):

1. `GITHUB_PAT` environment variable
2. `--pat` flag
3. Interactive prompt (masked input)

## Using a settings file

If a `settings.json` file exists in your working directory (or at the path given by `--settings`), the CLI will use it to pre-fill environment variables instead of prompting interactively.

```json
{
  "templateUrl": "https://github.com/AlphaSquadTech/saleor-template-standard.git",
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.example.com/graphql/",
    "NEXT_PUBLIC_SITE_URL": "http://localhost:3000",
    "NEXT_PUBLIC_STOREFRONT_URL": "http://localhost:3000",
    "NEXT_PUBLIC_SALEOR_CHANNEL": "default-channel"
  }
}
```

If no `settings.json` is found, the CLI reads `.env.example` from the cloned template and prompts you for each value.

## What it does

The CLI runs through 6 steps:

1. **Resolve authentication** — SSH keys (default) or HTTPS + PAT
2. **Clone template** — clones the selected template repo
3. **Fresh git init** — removes template history and creates a clean repo
4. **Initialize submodules** — syncs and updates git submodules (if any)
5. **Create `.env.local`** — from `settings.json` values or interactive prompts
6. **Final setup** — creates `redirects.json` and makes an initial commit

## Examples

```bash
# Fully interactive — prompts for template, uses SSH
npx @alphasquad/create-storefront-cli --name my-store

# Skip template prompt by passing --template directly
npx @alphasquad/create-storefront-cli --name my-store --template standard

# Explicit PAT (switches to HTTPS mode)
npx @alphasquad/create-storefront-cli --name my-store --pat ghp_xxx

# PAT from environment
GITHUB_PAT=ghp_xxx npx @alphasquad/create-storefront-cli --name my-store

# Force HTTPS mode — prompts for PAT interactively
npx @alphasquad/create-storefront-cli --name my-store --no-ssh

# Custom template repo
npx @alphasquad/create-storefront-cli --name my-store --template-url https://github.com/org/repo.git
```

## After scaffolding

```bash
cd my-store
yarn install
yarn dev
```

## License

ISC
