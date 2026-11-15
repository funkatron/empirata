#!/usr/bin/env bash
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "nvm is required to install Node 24.22.2" >&2
  exit 1
fi

set +u
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm install 24.22.2
nvm alias default 24.22.2
set -u

node_bin="$NVM_DIR/versions/node/v24.22.2/bin"
export PATH="$node_bin:$PATH"
hash -r
node -e 'if (process.versions.node.split(".")[0] !== "24") process.exit(1)'

marker="# empirata-node-24"
if [[ -f "$HOME/.bashrc" ]] && ! grep -qF "$marker" "$HOME/.bashrc"; then
  printf '\n%s\nexport PATH="%s:$PATH"\n' "$marker" "$node_bin" >>"$HOME/.bashrc"
fi

npm ci --no-audit --no-fund
npm run build