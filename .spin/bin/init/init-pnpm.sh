#!/usr/bin/bash

export PATH=$PATH:/home/spin/.nvm/versions/node/$(node -v)/bin

# Install pnpm.
# See https://github.com/Shopify/spin/issues/6761
if ! command -v pnpm &> /dev/null
then
  echo "Installing pnpm..."
  npm install -g pnpm
else
  echo "pnpm already installed."
fi
