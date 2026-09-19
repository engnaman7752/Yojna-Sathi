#!/bin/sh
# Runs once when the stack comes up: create the table, then load the published
# schemes so the demo has something to evaluate.
set -eu

echo "[seed] creating table"
sh /infra/create-table.sh

echo "[seed] loading schemes from /data/schemes"
# INCOMPLETE. Loading a scheme version needs the Phase 2 migration path, which
# does not exist yet: there is no scheme repository and no admin endpoint to
# post a version to. Until then the backend reads data/schemes/*.json straight
# off disk at startup (Phase 1 behaviour), which is why the compose file mounts
# ./data into the backend read-only and the demo still works.
echo "[seed] skipped: DynamoDB scheme loading arrives with Phase 2"

echo "[seed] done"
