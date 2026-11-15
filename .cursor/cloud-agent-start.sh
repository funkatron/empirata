#!/usr/bin/env bash
set -euo pipefail

export PATH="${HOME}/.nvm/versions/node/v24.22.2/bin:${PATH}"

if [[ ! -f dist/index.html ]]; then
  echo "dist/index.html is missing. Build the site before starting." >&2
  exit 1
fi

if node -e 'const net=require("node:net");const socket=net.connect(4173,"127.0.0.1",()=>{socket.end();process.exit(0)});socket.on("error",()=>process.exit(1))'; then
  echo "Empirata already listening on 127.0.0.1:4173"
  exit 0
fi

exec npm start