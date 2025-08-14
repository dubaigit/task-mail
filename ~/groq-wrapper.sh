#!/bin/bash
export NODE_OPTIONS="--import file:///$(pwd)/~/groq-code-cli/dist/core/loader.js"
cd ~/groq-code-cli
node dist/core/cli.js "$@"