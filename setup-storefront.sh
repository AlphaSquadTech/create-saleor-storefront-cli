#!/usr/bin/env bash
# ============================================================
#  WSM Storefront + GitHub Repo Setup Script
#  Usage: bash setup-storefront.sh
# ============================================================

set -e

# ── Colours ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

print_step() { echo -e "\n${CYAN}${BOLD}▶  $1${NC}"; }
print_ok()   { echo -e "${GREEN}✔  $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠  $1${NC}"; }
print_err()  { echo -e "${RED}✖  $1${NC}"; }
divider()    { echo -e "${DIM}────────────────────────────────────────────────────${NC}"; }

# ── Config ───────────────────────────────────────────────────
ORG="webshopmanager"


# ── Pre-flight checks ────────────────────────────────────────
for cmd in node npm git curl; do
  command -v $cmd >/dev/null 2>&1 || { print_err "$cmd is required but not installed."; exit 1; }
done

# ── Banner ───────────────────────────────────────────────────
clear
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║        WSM Storefront + GitHub Setup         ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ════════════════════════════════════════════════════════════
#  STEP 1 — Storefront Name
# ════════════════════════════════════════════════════════════
print_step "STEP 1 — Storefront Name"
divider

while true; do
  read -rp "  Enter storefront name (e.g. my-store): " SF_NAME
  SF_NAME=$(echo "$SF_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  if [[ -z "$SF_NAME" ]]; then
    print_warn "Name cannot be empty."
  elif [[ ! "$SF_NAME" =~ ^[a-z0-9_-]+$ ]]; then
    print_warn "Name must contain only lowercase letters, numbers, hyphens or underscores."
  else
    break
  fi
done

print_ok "Storefront name: ${BOLD}$SF_NAME${NC}"

# ════════════════════════════════════════════════════════════
#  STEP 2 — Template Selection
# ════════════════════════════════════════════════════════════
print_step "STEP 2 — Select Template"
divider
echo ""
echo "  1) basic"
echo "  2) standard"
echo "  3) advanced"
echo ""

while true; do
  read -rp "  Enter choice [1/2/3]: " TEMPLATE_CHOICE
  case "$TEMPLATE_CHOICE" in
    1) TEMPLATE="basic";    break ;;
    2) TEMPLATE="standard"; break ;;
    3) TEMPLATE="advanced"; break ;;
    *) print_warn "Please enter 1, 2, or 3." ;;
  esac
done

print_ok "Template selected: ${BOLD}$TEMPLATE${NC}"

# ════════════════════════════════════════════════════════════
#  STEP 3 — Create the Storefront
# ════════════════════════════════════════════════════════════
print_step "STEP 3 — Creating Storefront"
divider
echo ""
echo -e "  ${DIM}The CLI will now prompt you to fill in environment variables."
echo -e "  Press Enter on each field to keep the default value.${NC}"
echo ""
echo -e "  Running: ${DIM}npx @webshopmanager/create-storefront-cli --name $SF_NAME --template $TEMPLATE${NC}"
echo ""

npx @webshopmanager/create-storefront-cli --name "$SF_NAME" --template "$TEMPLATE"

# ── Locate the created folder ─────────────────────────────────
SF_DIR="$(pwd)/$SF_NAME"
if [[ ! -d "$SF_DIR" ]]; then
  SF_DIR=$(find "$(pwd)" -maxdepth 1 -type d -newer "$(pwd)" | grep -v "^$(pwd)$" | head -1)
fi
if [[ -z "$SF_DIR" || ! -d "$SF_DIR" ]]; then
  print_err "Could not locate the created storefront folder. Did the CLI complete successfully?"
  exit 1
fi

print_ok "Storefront created at: ${BOLD}$SF_DIR${NC}"

# ════════════════════════════════════════════════════════════
#  STEP 4 — GitHub Authentication
# ════════════════════════════════════════════════════════════
print_step "STEP 4 — GitHub Authentication"
divider
echo ""
echo -e "  A GitHub PAT with ${BOLD}repo${NC} scope is required to create repos."
echo    "  Generate one at: https://github.com/settings/tokens"
echo ""
read -rsp "  Paste your GitHub PAT (input hidden): " GH_TOKEN
echo ""

if [[ -z "$GH_TOKEN" ]]; then
  print_err "No token provided. Aborting."
  exit 1
fi

echo ""
echo -e "  ${DIM}Validating token...${NC}"
HTTP_CHECK=$(curl -s -o /tmp/gh_user.json -w "%{http_code}" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/user")

if [[ "$HTTP_CHECK" == "200" ]]; then
  GH_LOGIN=$(python3 -c "import json; print(json.load(open('/tmp/gh_user.json')).get('login','?'))" 2>/dev/null || echo "?")
  print_ok "Token valid — authenticated as: ${BOLD}$GH_LOGIN${NC}"
elif [[ "$HTTP_CHECK" == "401" ]]; then
  print_err "Token is invalid or expired. Generate a new one and try again."
  exit 1
elif [[ "$HTTP_CHECK" == "403" ]]; then
  print_err "Token lacks required permissions. Make sure 'repo' scope is enabled."
  exit 1
else
  print_warn "Could not validate token (HTTP $HTTP_CHECK) — proceeding anyway."
fi

# ════════════════════════════════════════════════════════════
#  STEP 5 — Create GitHub Repository
# ════════════════════════════════════════════════════════════
print_step "STEP 5 — Create GitHub Repository"
divider

echo ""
read -rp "  Enter GitHub repo name [default: $SF_NAME]: " REPO_NAME
REPO_NAME="${REPO_NAME:-$SF_NAME}"
REPO_NAME=$(echo "$REPO_NAME" | tr ' ' '-')

echo ""
echo -e "  Org:         ${BOLD}$ORG${NC}"
echo -e "  Repo:        ${BOLD}$REPO_NAME${NC}  (private)"
echo -e "  README:      No  |  .gitignore: No  |  License: No  |  Template: No"
echo ""
read -rp "  Confirm and create? [y/N]: " CONFIRM
[[ ! "$CONFIRM" =~ ^[Yy]$ ]] && { print_warn "Aborted."; exit 0; }

HTTP_STATUS=$(curl -s -o /tmp/gh_response.json -w "%{http_code}" \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/orgs/$ORG/repos" \
  -d "{\"name\":\"$REPO_NAME\",\"private\":true,\"auto_init\":false,\"has_issues\":true,\"has_projects\":false,\"has_wiki\":false}")

REPO_URL="https://github.com/$ORG/$REPO_NAME"

if [[ "$HTTP_STATUS" == "201" ]]; then
  print_ok "Repository created: ${BOLD}$REPO_URL${NC}"
elif [[ "$HTTP_STATUS" == "422" ]]; then
  print_warn "Repo already exists on GitHub — pushing code into it."
else
  ERROR_MSG=$(python3 -c "import json; print(json.load(open('/tmp/gh_response.json')).get('message','Unknown'))" 2>/dev/null || cat /tmp/gh_response.json)
  print_err "GitHub API returned HTTP $HTTP_STATUS: $ERROR_MSG"
  exit 1
fi

# ════════════════════════════════════════════════════════════
#  STEP 6 — Push Code via SSH
# ════════════════════════════════════════════════════════════
print_step "STEP 6 — Pushing Code to GitHub"
divider

cd "$SF_DIR"

REMOTE="https://$GH_TOKEN@github.com/$ORG/$REPO_NAME.git"

[[ ! -d ".git" ]] && git init && git branch -M main

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE"
else
  git remote add origin "$REMOTE"
fi

git add -A
git commit -m "feat: initial storefront — $SF_NAME ($TEMPLATE template)" 2>/dev/null || \
  print_warn "Nothing new to commit — pushing existing commits."

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  git branch -m "$BRANCH" main
fi
git push -u origin main

print_ok "Code pushed to: ${BOLD}$REPO_URL${NC}"

# ════════════════════════════════════════════════════════════
#  Done
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║              ✔  All done!                    ║"
echo "  ╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  ${BOLD}Storefront:${NC}  $SF_DIR"
echo -e "  ${BOLD}GitHub:${NC}      $REPO_URL"
echo ""
echo    "  Next steps:"
echo    "    cd $SF_DIR"
echo    "    yarn install && yarn dev"
echo ""
