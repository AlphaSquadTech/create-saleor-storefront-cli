# Storefront Tooling Handover

This document explains how to use and maintain the storefront creation tooling in this repository.

It covers:

- `index.js`: the Node.js CLI that scaffolds a Saleor storefront from a template.
- `setup-storefront.sh`: the guided Bash wrapper that runs the CLI, creates a GitHub repository, and pushes the generated storefront code.

## Walkthrough Recordings

- Storefront creation walkthrough: https://jam.dev/c/42bdff0d-ae20-4710-a29e-8d256f55aea2
- Vercel deployment walkthrough: https://jam.dev/c/6642931c-b501-48bc-9ef0-c979b4d0d055

## Repository Contents

| File | Purpose |
| --- | --- |
| `index.js` | Main CLI executable. Published through the package binary as `create-storefront`. |
| `setup-storefront.sh` | Interactive setup script for creating a storefront and pushing it to GitHub. |
| `settings.json` | Optional defaults for template URL and environment variables. |
| `package.json` | Package metadata, binary mapping, and Node engine requirement. |
| `README.md` | Public package README with basic CLI usage. |

## Prerequisites

Required for `index.js`:

- Node.js `>=18`
- `npm` or `npx`
- `git`
- Access to the storefront template repositories
- GitHub SSH key configured, or a GitHub Personal Access Token (PAT)

Required for `setup-storefront.sh`:

- `bash`
- `node`
- `npm`
- `git`
- `curl`
- `python3`
- A GitHub PAT with permission to create repositories in the target organization
- `yarn`, if following the generated next-step command

The Bash script checks for `node`, `npm`, `git`, and `curl`. It also uses `python3`, but does not currently check for it during pre-flight.

## Tool 1: `index.js`

`index.js` is the primary scaffolding CLI. It clones a storefront template, removes the template Git history, initializes a fresh Git repository, writes environment config, and creates an initial commit.

### Basic Usage

From this repository:

```bash
node index.js --name my-store --template standard
```

From npm, after the package is published:

```bash
npx @webshopmanager/create-storefront-cli --name my-store --template standard
```

If installed globally:

```bash
npm i -g @webshopmanager/create-storefront-cli
create-storefront --name my-store --template standard
```

### CLI Options

| Option | Required | Description |
| --- | --- | --- |
| `--name <tenant-name>` | Yes | Storefront tenant name and target directory name. |
| `--template <basic|standard|advanced>` | No | Template selection. If omitted, the CLI prompts interactively. |
| `--no-ssh` | No | Disables SSH clone mode and uses HTTPS with a PAT. |
| `--pat <token>` | No | GitHub PAT. Providing this switches the CLI to HTTPS mode. |
| `--settings <path>` | No | Path to a settings JSON file. Defaults to `./settings.json` in the current working directory. |
| `--template-url <git-url>` | No | Custom template Git URL. Overrides the selected template URL. |
| `--help` | No | Prints usage help. |

### Template Selection

The CLI defines three template names:

| Template | Repository | Status |
| --- | --- | --- |
| `basic` | `AlphaSquadTech/saleor-template-basic` | Marked as not ready. The CLI exits with a work-in-progress message. |
| `standard` | `webshopmanager/saleor-template-standard` | Ready. |
| `advanced` | `webshopmanager/saleor-template-advance` | Ready. |

If `--template-url` or `settings.json.templateUrl` is provided, it overrides the built-in template URL.

### Authentication

SSH is the default mode.

```bash
node index.js --name my-store --template standard
```

In SSH mode, the CLI uses the configured GitHub SSH key and SSH agent to clone the template repository.

HTTPS/PAT mode is used when:

- `--no-ssh` is passed
- `--pat <token>` is passed
- `GITHUB_PAT` is set in the environment

PAT resolution order:

1. `GITHUB_PAT`
2. `--pat`
3. Masked interactive prompt

Examples:

```bash
GITHUB_PAT=ghp_xxx node index.js --name my-store --template standard
node index.js --name my-store --template standard --pat ghp_xxx
node index.js --name my-store --template standard --no-ssh
```

### Settings File

The CLI looks for `settings.json` in the current working directory unless `--settings` is provided. A `settings.json` bundled inside an installed npm package is not automatically loaded unless the command is run from that directory or the file path is passed explicitly.

Example:

```json
{
  "templateUrl": "https://github.com/webshopmanager/saleor-template-standard.git",
  "env": {
    "NEXT_PUBLIC_API_URL": "https://api.example.com/graphql/",
    "NEXT_PUBLIC_SITE_URL": "http://localhost:3000",
    "NEXT_PUBLIC_STOREFRONT_URL": "http://localhost:3000",
    "NEXT_PUBLIC_SALEOR_CHANNEL": "default-channel"
  }
}
```

When a settings file is found:

- `templateUrl` is used as the source template if present.
- `env` values are written into the generated `.env.local`.
- `NEXT_PUBLIC_TENANT_NAME` is automatically set to the `--name` value.

When no settings file is found:

- The CLI reads `.env.example` from the cloned template.
- It prompts for each environment variable.
- Pressing Enter keeps the value from `.env.example`.

If the template does not contain `.env.example`, the CLI falls back to this minimal environment set:

```env
NEXT_PUBLIC_API_URL=""
NEXT_PUBLIC_ASSETS_BASE_URL=""
NEXT_PUBLIC_TENANT_NAME=""
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_STOREFRONT_URL="http://localhost:3000"
```

### What `index.js` Does

The CLI runs these steps:

1. Resolves authentication mode.
2. Loads `settings.json`, if present.
3. Resolves the template URL.
4. Clones the selected template into a new directory named from `--name`.
5. Reads `.gitmodules`, if present.
6. Deletes the template `.git` directory.
7. Removes placeholder submodule directories and recreates submodules.
8. Initializes a fresh Git repository.
9. Creates `.env.local`.
10. Creates `redirects.json` with an empty array.
11. Commits all generated files with the initial scaffold commit message.

### Generated Output

For `--name my-store`, the CLI creates:

```text
my-store/
  .env.local
  redirects.json
  .git/
  ...template files
```

After generation:

```bash
cd my-store
yarn install
yarn dev
```

### Submodule Handling

If the template has `.gitmodules`, the CLI:

- Parses the existing submodule paths and URLs.
- Deletes the cloned template Git history.
- Re-adds submodules to the fresh repository.
- In PAT mode, temporarily configures Git URL rewrites so submodules can authenticate.
- Attempts to remove those global Git URL rewrites after submodules are added.

If a run fails during PAT-mode submodule setup, inspect global Git config to ensure no PAT-bearing rewrite remains:

```bash
git config --global --list
```

Remove any accidental rewrite entries manually if needed.

## Tool 2: `setup-storefront.sh`

`setup-storefront.sh` is an interactive Bash script that wraps the CLI and then creates/pushes to a GitHub repository.

It is intended for a guided, one-run setup flow.

### Basic Usage

```bash
bash setup-storefront.sh
```

The script prompts for:

1. Storefront name
2. Template choice
3. Environment variables, through the underlying CLI
4. GitHub PAT
5. GitHub repository name
6. Confirmation before creating the GitHub repository

### Organization Target

The script creates repositories under:

```bash
ORG="webshopmanager"
```

To create repositories under a different GitHub organization, edit the `ORG` variable in `setup-storefront.sh`.

### What `setup-storefront.sh` Does

The script runs these steps:

1. Checks that required commands are installed.
2. Prompts for a storefront name.
3. Prompts for template selection.
4. Runs the CLI through `npx`.
5. Locates the generated storefront directory.
6. Prompts for a GitHub PAT.
7. Validates the PAT against GitHub's `/user` API.
8. Prompts for a GitHub repository name.
9. Creates a private GitHub repository under the configured organization.
10. Initializes Git in the generated storefront directory if needed.
11. Sets `origin` to an HTTPS remote containing the PAT.
12. Commits all files if there are uncommitted changes.
13. Pushes `main` to GitHub.

### Script Flow

Run:

```bash
bash setup-storefront.sh
```

Example prompt values:

```text
Enter storefront name: my-store
Select template: standard
Paste your GitHub PAT: ghp_xxx
Enter GitHub repo name [default: my-store]: my-store
Confirm and create? [y/N]: y
```

Final output includes:

```text
Storefront: /path/to/my-store
GitHub:     https://github.com/webshopmanager/my-store
```

### Important Package Name Note

`package.json` names the package:

```text
@webshopmanager/create-storefront-cli
```

However, `setup-storefront.sh` currently runs:

```bash
npx @webshopmanager/create-storefront-cli --name "$SF_NAME" --template "$TEMPLATE"
```

Before handing this script to a client, confirm which npm package should be used. If the intended package is the one in this repository, update the script command to:

```bash
npx @webshopmanager/create-storefront-cli --name "$SF_NAME" --template "$TEMPLATE"
```

### GitHub Token Security

The Bash script pushes using an HTTPS remote formatted like:

```text
https://<PAT>@github.com/<org>/<repo>.git
```

This can leave the token in the local Git remote URL. After a successful push, check the remote:

```bash
git remote -v
```

If the PAT is visible, replace the remote with a safe URL:

```bash
git remote set-url origin https://github.com/webshopmanager/my-store.git
```

Or use SSH:

```bash
git remote set-url origin git@github.com:webshopmanager/my-store.git
```

Do not commit, share, screenshot, or paste PAT-bearing remote URLs.

## Common Workflows

### Create Storefront Only

Use this when the GitHub repository already exists or will be handled separately:

```bash
node index.js --name my-store --template standard
cd my-store
yarn install
yarn dev
```

### Create Storefront with Settings File

```bash
node index.js --name my-store --template standard --settings ./settings.json
```

### Create Storefront and Push to GitHub

Use the guided script:

```bash
bash setup-storefront.sh
```

### Use a Custom Template Repository

```bash
node index.js --name my-store --template-url https://github.com/org/custom-template.git
```

In SSH mode, GitHub HTTPS URLs are converted to SSH automatically:

```text
https://github.com/org/custom-template.git
git@github.com:org/custom-template.git
```

## End-to-End Client Workflow

Use this workflow when creating a new storefront and deploying it to Vercel.

### 1. Scaffold the Storefront

Run the CLI to create the storefront. You need the storefront name and GitHub access to the template repository.

```bash
npx @webshopmanager/create-storefront-cli --name my-store
```

If the package has been migrated to the Webshop Manager npm scope, use:

```bash
npx @webshopmanager/create-storefront-cli --name my-store
```

The CLI clones the selected template, initializes a fresh Git repository, pulls in the `core/` submodule when present, and creates `.env.local` from the configured settings or prompted values.

### 2. Change Directory

```bash
cd my-store
```

### 3. Install Dependencies

```bash
yarn install
```

The storefront templates may use a `preinstall` hook to initialize the `core/` submodule. If dependency installation fails, check that the GitHub account or deployment key has access to the core repository.

### 4. Configure Environment Variables

Open `.env.local` and fill in the required values for the storefront.

At minimum, confirm these values:

```env
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SALEOR_CHANNEL=
```

Other template-specific values may also be required, depending on the selected storefront template and integrations.

### 5. Verify Locally

Start the development server:

```bash
yarn dev
```

Open the local URL shown by the dev server and verify that the storefront loads, products resolve from Saleor, assets load correctly, and there are no missing environment variable errors.

### 6. Push to GitHub

Create a new GitHub repository for the storefront, then push the generated code.

Using SSH:

```bash
git remote add origin git@github.com:your-org/my-store.git
git push -u origin main
```

If `origin` already exists, update it instead:

```bash
git remote set-url origin git@github.com:your-org/my-store.git
git push -u origin main
```

### 7. Import to Vercel

Go to:

```text
https://vercel.com/new
```

Import the GitHub repository that was just pushed.

### 8. Encode the Private Key

Vercel needs access to private Git submodules during install/build. Encode the private SSH key that has access to the required repositories:

```bash
base64 -i /path/to/private-key
```

On some Linux environments, use:

```bash
base64 -w 0 /path/to/private-key
```

Copy the encoded output and store it only as a Vercel environment variable. Do not commit it to the repository.

### 9. Set Vercel Environment Variables

In the Vercel project settings, add all variables from `.env.local`.

Update `NEXT_PUBLIC_SITE_URL` to the production domain, for example:

```env
NEXT_PUBLIC_SITE_URL=https://my-store.vercel.app
```

Add the submodule private-key variable expected by the selected template:

```env
SALEOR_STANDARD_SSH_PRIVATE_KEY_BASE64=<base64-private-key>
```

Use this for `standard` and `advanced` templates.

For the `basic` template, use:

```env
SALEOR_SSH_PRIVATE_KEY_BASE64=<base64-private-key>
```

### 10. Deploy

Click Deploy in Vercel. Vercel will run:

```bash
yarn install
yarn build
```

After deployment, verify the production URL, confirm Saleor API connectivity, and check that submodule-dependent code was available during the build.

## Troubleshooting

### `--name is required`

Pass a storefront name:

```bash
node index.js --name my-store --template standard
```

### Template Clone Fails

Check:

- The template repository exists.
- The current user has repository access.
- SSH keys are configured if using SSH.
- `GITHUB_PAT` or `--pat` has access if using HTTPS.

### `basic` Template Exits Without Creating a Storefront

The `basic` template is marked as not ready in `index.js`. Use `standard` or `advanced`.

### Target Directory Already Exists

The CLI refuses to overwrite an existing target directory. Remove, rename, or choose another `--name`.

### `settings.json` Parse Error

Ensure the file is valid JSON. JSON does not allow trailing commas or comments.

### Git Commit Fails

The generated project needs a valid Git identity:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### GitHub Repo Creation Fails

Check:

- The PAT is valid.
- The PAT has permission to create repositories in the configured organization.
- The repository name is available.
- The authenticated GitHub user is a member of the target organization.

### `python3` Not Found in `setup-storefront.sh`

Install Python 3 or update the script to avoid Python for JSON parsing. The script uses Python to read GitHub API response JSON.

## Maintenance Notes

- Keep `README.md`, `index.js --help`, and this handover document in sync when CLI flags change.
- Confirm the npm package name used by `setup-storefront.sh` before client use.
- Confirm whether `basic` should remain disabled.
- Rotate any PAT that may have been exposed through shell history, terminal logs, or Git remote URLs.
- If template repositories move, update the `TEMPLATES` registry in `index.js`.
- If the GitHub organization changes, update `ORG` in `setup-storefront.sh`.
