#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ─── Colors (ANSI) ───────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

const ok = (msg) => console.log(`${c.green}  ✔${c.reset} ${msg}`);
const info = (msg) => console.log(`${c.cyan}  ℹ${c.reset} ${msg}`);
const warn = (msg) => console.log(`${c.yellow}  ⚠${c.reset} ${msg}`);
const fail = (msg) => {
  console.error(`${c.red}  ✖ ${msg}${c.reset}`);
  process.exit(1);
};
const step = (n, msg) =>
  console.log(
    `\n${c.bold}${c.cyan}[${n}]${c.reset} ${c.bold}${msg}${c.reset}`
  );

// ─── Parse args ──────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

// ─── Sync prompts via /dev/tty ───────────────────────────────────

/** Prompt the user for a single value (sync via blocking stdin read). */
function promptSync(question) {
  process.stdout.write(question);
  const buf = Buffer.alloc(1024);
  let input = "";
  try {
    const fd = fs.openSync("/dev/tty", "rs");
    while (true) {
      const bytesRead = fs.readSync(fd, buf, 0, buf.length);
      const chunk = buf.toString("utf8", 0, bytesRead);
      input += chunk;
      if (input.includes("\n")) break;
    }
    fs.closeSync(fd);
  } catch {
    // Fallback for environments without /dev/tty
    const fd = fs.openSync(0, "rs");
    while (true) {
      const bytesRead = fs.readSync(fd, buf, 0, buf.length);
      const chunk = buf.toString("utf8", 0, bytesRead);
      input += chunk;
      if (input.includes("\n")) break;
    }
  }
  return input.replace(/\n$/, "").replace(/\r$/, "");
}

/** Prompt for a secret value — reads char-by-char and prints * for each. */
function promptSecret(question) {
  process.stdout.write(question);
  let input = "";
  const buf = Buffer.alloc(1);
  let fd;
  try {
    fd = fs.openSync("/dev/tty", "rs");
  } catch {
    fd = fs.openSync(0, "rs");
  }
  // Put terminal into raw mode so we get one char at a time
  try {
    execSync("stty -echo raw", { stdio: ["inherit", "pipe", "pipe"] });
  } catch {
    // stty may not be available; fall back to unmasked prompt
    try { fs.closeSync(fd); } catch {}
    return promptSync(question);
  }
  try {
    while (true) {
      const bytesRead = fs.readSync(fd, buf, 0, 1);
      if (bytesRead === 0) continue;
      const ch = buf.toString("utf8", 0, 1);
      // Enter
      if (ch === "\r" || ch === "\n") {
        process.stdout.write("\n");
        break;
      }
      // Backspace / DEL
      if (ch === "\x7f" || ch === "\b") {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write("\b \b");
        }
        continue;
      }
      // Ctrl-C
      if (ch === "\x03") {
        process.stdout.write("\n");
        process.exit(130);
      }
      input += ch;
      process.stdout.write("*");
    }
  } finally {
    try {
      execSync("stty echo cooked", { stdio: ["inherit", "pipe", "pipe"] });
    } catch {}
    try { fs.closeSync(fd); } catch {}
  }
  return input;
}

// ─── Env helpers ─────────────────────────────────────────────────

/** Parse a .env file into an array of { key, value, raw } entries (preserving comments/blanks). */
function parseEnvFile(content) {
  const entries = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      entries.push({ key, value, raw: line });
    } else {
      entries.push({ key: null, value: null, raw: line });
    }
  }
  return entries;
}

/** Interactively prompt for each env key, showing the default from .env.example. */
function promptForEnvValues(entries) {
  const overrides = {};
  console.log(
    `\n${c.bold}  Fill in environment values.${c.reset} ${c.dim}(press Enter to keep default)${c.reset}\n`
  );
  for (const entry of entries) {
    if (!entry.key) continue;
    const defaultVal = entry.value || "";
    const answer = promptSync(
      `  ${c.cyan}${entry.key}${c.reset} ${c.dim}[${defaultVal}]${c.reset}: `
    );
    overrides[entry.key] = answer !== "" ? answer : defaultVal;
  }
  console.log();
  return overrides;
}

// ─── Shell helper ────────────────────────────────────────────────
function run(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: "pipe", ...opts });
  } catch (e) {
    fail(
      `Command failed: ${cmd}\n${e.stderr ? e.stderr.toString() : e.message}`
    );
  }
}

// ─── Template registry ───────────────────────────────────────────
const TEMPLATES = {
  standard: {
    url: "https://github.com/AlphaSquadTech/saleor-template-standard.git",
    ready: true,
  },
  advanced: {
    url: null,
    ready: false,
  },
  basic: {
    url: null,
    ready: false,
  },
};

const VALID_TEMPLATES = Object.keys(TEMPLATES);

const MINIMAL_ENV = [
  'NEXT_PUBLIC_API_URL=""',
  'NEXT_PUBLIC_ASSETS_BASE_URL=""',
  'NEXT_PUBLIC_TENANT_NAME=""',
  'NEXT_PUBLIC_SITE_URL="http://localhost:3000"',
  'NEXT_PUBLIC_STOREFRONT_URL="http://localhost:3000"',
].join("\n");

// ─── Main ────────────────────────────────────────────────────────

const args = parseArgs(process.argv);

if (args.help) {
  console.log(`
${c.bold}newCliTool${c.reset} — Standalone storefront scaffolding CLI

${c.bold}Usage:${c.reset}
  node cli/newCliTool/index.js --name <tenant-name> [options]

${c.bold}Options:${c.reset}
  --name          ${c.dim}(required)${c.reset}  Tenant / directory name
  --template      ${c.dim}(optional)${c.reset}  Template variant: standard, advanced, basic (default: standard)
  --pat           ${c.dim}(optional)${c.reset}  GitHub Personal Access Token
  --settings      ${c.dim}(optional)${c.reset}  Path to settings.json (default: ./settings.json)
  --template-url  ${c.dim}(optional)${c.reset}  Git URL (overrides --template)
  --help          Show this message

${c.bold}PAT resolution order:${c.reset}
  1. GITHUB_PAT environment variable
  2. --pat flag
  3. Interactive prompt (masked)

${c.bold}settings.json format:${c.reset}
  {
    "templateUrl": "https://github.com/org/repo.git",
    "env": {
      "NEXT_PUBLIC_API_URL": "https://api.example.com/graphql/",
      ...
    }
  }

  If no settings.json is found, the CLI will read .env.example from
  the cloned repo and interactively prompt for each value.

${c.bold}Examples:${c.reset}
  ${c.dim}# With settings.json in CWD${c.reset}
  GITHUB_PAT=ghp_xxx node cli/newCliTool/index.js --name my-tenant

  ${c.dim}# With explicit paths${c.reset}
  node cli/newCliTool/index.js --name my-tenant --pat ghp_xxx --settings /path/to/settings.json

  ${c.dim}# Fully interactive${c.reset}
  node cli/newCliTool/index.js --name my-tenant
`);
  process.exit(0);
}

if (!args.name) {
  fail("--name is required. Run with --help for usage.");
}

// ─── Resolve template variant ────────────────────────────────────
const templateChoice = (args.template || "standard").toLowerCase();

if (!VALID_TEMPLATES.includes(templateChoice)) {
  fail(
    `Unknown template "${templateChoice}". Available templates: ${VALID_TEMPLATES.join(", ")}`
  );
}

if (!TEMPLATES[templateChoice].ready) {
  console.log(`
${c.bold}${c.yellow}┌──────────────────────────────────────────────────┐
│  The "${templateChoice}" template is a work in progress.   │
│                                                  │
│  Only the "standard" template is available today. │
│  Stay tuned — more templates are coming soon!     │
└──────────────────────────────────────────────────┘${c.reset}
`);
  process.exit(0);
}

// ─── Step 1: Resolve PAT ─────────────────────────────────────────
step("1/6", "Resolving GitHub PAT…");

let pat = process.env.GITHUB_PAT || args.pat || null;

if (pat) {
  ok(
    `PAT resolved from ${process.env.GITHUB_PAT ? "GITHUB_PAT env var" : "--pat flag"}.`
  );
} else {
  info("No PAT found in environment or flags — prompting.");
  pat = promptSecret(
    `  ${c.cyan}GitHub PAT${c.reset}: `
  );
  if (!pat) {
    fail("A GitHub PAT is required to clone private repos.");
  }
  ok("PAT received.");
}

// ─── Resolve settings ────────────────────────────────────────────
const settingsPath = path.resolve(
  args.settings || path.join(process.cwd(), "settings.json")
);

let settings = {};
let hasSettings = false;
if (fs.existsSync(settingsPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    hasSettings = true;
    ok(`Loaded settings from ${settingsPath}`);
  } catch (e) {
    fail(`Failed to parse settings.json: ${e.message}`);
  }
} else {
  warn(
    `No settings.json found at ${settingsPath} — will prompt for env values after clone.`
  );
}

const envOverrides = settings.env || {};
const TENANT_NAME = args.name;
const TEMPLATE_URL =
  args["template-url"] || settings.templateUrl || TEMPLATES[templateChoice].url;
const TARGET_DIR = path.resolve(process.cwd(), TENANT_NAME);

// Inject PAT into the template URL for authenticated clone
function injectPat(url, token) {
  // Convert https://github.com/... → https://<PAT>@github.com/...
  return url.replace(/^https:\/\//, `https://${token}@`);
}

// ─── Banner ──────────────────────────────────────────────────────
console.log(`
${c.bold}${c.cyan}┌──────────────────────────────────────┐
│     newCliTool  v1.0.0               │
│     Standalone Storefront Scaffold   │
└──────────────────────────────────────┘${c.reset}
`);
info(`Tenant:   ${c.bold}${TENANT_NAME}${c.reset}`);
info(`Template: ${c.bold}${templateChoice}${c.reset} ${c.dim}(${TEMPLATE_URL})${c.reset}`);
if (hasSettings) {
  const overrideKeys = Object.keys(envOverrides);
  if (overrideKeys.length > 0) {
    info(`Env overrides: ${overrideKeys.join(", ")}`);
  }
}

// ─── Step 2: Clone template ──────────────────────────────────────
step("2/6", "Cloning template repository…");

if (fs.existsSync(TARGET_DIR)) {
  fail(`Directory "${TENANT_NAME}" already exists.`);
}

const authUrl = injectPat(TEMPLATE_URL, pat);
run(`git clone "${authUrl}" "${TARGET_DIR}"`);
ok("Template cloned.");

// ─── Step 3: Init submodule ──────────────────────────────────────
step("3/6", "Initializing submodules…");

// Configure git URL rewrite so submodule fetches also use the PAT
run(
  `git config --global url."https://${pat}@github.com/".insteadOf "https://github.com/"`,
  { cwd: TARGET_DIR }
);
run("git submodule sync", { cwd: TARGET_DIR });
run("git submodule update --init --recursive", { cwd: TARGET_DIR });

// Clean up the global URL rewrite so it doesn't leak into other operations
try {
  execSync(
    'git config --global --unset url."https://' +
      pat +
      '@github.com/".insteadOf',
    { stdio: "pipe" }
  );
} catch {
  // May already be absent — that's fine
}

ok("Submodules initialized.");

// ─── Step 4: .env.local ──────────────────────────────────────────
step("4/6", "Creating .env.local…");

const envExamplePath = path.join(TARGET_DIR, ".env.example");

let envContent = "";
if (fs.existsSync(envExamplePath)) {
  envContent = fs.readFileSync(envExamplePath, "utf8");
  info("Using .env.example from cloned repo as template.");
} else {
  warn(".env.example not found — using minimal env template.");
  envContent = MINIMAL_ENV;
}

let allOverrides;
if (hasSettings) {
  allOverrides = { NEXT_PUBLIC_TENANT_NAME: TENANT_NAME, ...envOverrides };
} else {
  info("No settings.json provided — prompting for env values.");
  const entries = parseEnvFile(envContent);
  const prompted = promptForEnvValues(entries);
  allOverrides = { ...prompted, NEXT_PUBLIC_TENANT_NAME: TENANT_NAME };
}

// Apply overrides
const appliedKeys = new Set();
for (const [key, value] of Object.entries(allOverrides)) {
  const regex = new RegExp(`^${key}=.*`, "m");
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}="${value}"`);
  } else {
    envContent += `\n${key}="${value}"`;
  }
  appliedKeys.add(key);
}

fs.writeFileSync(path.join(TARGET_DIR, ".env.local"), envContent);
ok(`.env.local created with ${appliedKeys.size} override(s).`);

// ─── Step 5: redirects.json ──────────────────────────────────────
step("5/6", "Creating redirects.json…");
fs.writeFileSync(path.join(TARGET_DIR, "redirects.json"), "[]\n");
ok("redirects.json created.");

// ─── Step 6: Fresh git init ──────────────────────────────────────
step("6/6", "Initializing fresh git repository…");

fs.rmSync(path.join(TARGET_DIR, ".git"), { recursive: true, force: true });
run("git init", { cwd: TARGET_DIR });
run("git add -A", { cwd: TARGET_DIR });
run('git commit -m "Initial commit — scaffolded from storefront template"', {
  cwd: TARGET_DIR,
});
ok("Fresh git repo initialized.");

// ─── Done ────────────────────────────────────────────────────────
console.log(`
${c.bold}${c.green}✅ Storefront "${TENANT_NAME}" is ready!${c.reset}

${c.bold}Next steps:${c.reset}
  ${c.cyan}cd ${TENANT_NAME}${c.reset}
  ${c.cyan}yarn install${c.reset}           ${c.dim}# Install dependencies${c.reset}
  ${c.cyan}yarn dev${c.reset}               ${c.dim}# Start dev server${c.reset}

${c.bold}Customize:${c.reset}
  ${c.dim}•${c.reset} Edit ${c.bold}.env.local${c.reset} for environment config
  ${c.dim}•${c.reset} Edit ${c.bold}src/app/globals.css${c.reset} for theme / branding
  ${c.dim}•${c.reset} Edit ${c.bold}redirects.json${c.reset} for tenant-specific redirects

${c.bold}Update core:${c.reset}
  ${c.cyan}cd core && git pull origin main && cd ..${c.reset}
  ${c.cyan}git add core && git commit -m "chore: bump core"${c.reset}
`);
