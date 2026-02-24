# @alphasquad/create-storefront-cli

A CLI tool for scaffolding Saleor storefronts from templates.

## Prerequisites

- Node.js >= 18
- Git
- A GitHub Personal Access Token (PAT) with repo access

## Quick start

```bash
npx @alphasquad/create-storefront-cli --name my-store
```

Or install globally:

```bash
npm i -g @alphasquad/create-storefront-cli
create-storefront --name my-store
```

## Options

| Flag             | Required | Description                                              |
| ---------------- | -------- | -------------------------------------------------------- |
| `--name`         | Yes      | Tenant / directory name                                  |
| `--template`     | No       | Template variant: `standard`, `advanced`, `basic` (default: `standard`) |
| `--pat`          | No       | GitHub Personal Access Token                             |
| `--settings`     | No       | Path to `settings.json` (default: `./settings.json`)     |
| `--template-url` | No       | Custom Git URL (overrides `--template`)                  |
| `--help`         | No       | Show help message                                        |

## PAT resolution order

The CLI resolves your GitHub PAT in this order:

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

## Examples

```bash
# Fully interactive (prompts for PAT and env values)
npx @alphasquad/create-storefront-cli --name my-store

# PAT from environment, settings from file
GITHUB_PAT=ghp_xxx npx @alphasquad/create-storefront-cli --name my-store

# Explicit PAT and settings path
npx @alphasquad/create-storefront-cli --name my-store --pat ghp_xxx --settings ./my-settings.json

# Custom template repo
npx @alphasquad/create-storefront-cli --name my-store --template-url https://github.com/org/repo.git
```

## What it does

The CLI runs through 6 steps:

1. **Resolve PAT** - from env, flag, or interactive prompt
2. **Clone template** - clones the selected template repo using authenticated HTTPS
3. **Initialize submodules** - syncs and updates git submodules
4. **Create `.env.local`** - from `settings.json` values or interactive prompts
5. **Create `redirects.json`** - empty redirects file for tenant-specific redirects
6. **Fresh git init** - removes template history and creates a clean initial commit

## After scaffolding

```bash
cd my-store
yarn install
yarn dev
```

## License

ISC
