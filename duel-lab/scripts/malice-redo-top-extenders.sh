#!/usr/bin/env bash
# Third-card table of the recommended routes (EXTENDERS-TOP.md), one extender at a time (resumable). Run from duel-lab/.
set -e
for code in 20938824 30118811 69272449 96676583 64865 74652966; do
  HITS_TAG=-top WORST_FROM=runtime/malice/batch-top.jsonl node scripts/malice-batch.mjs runtime/malice/batch-top-x$code.jsonl 60 ash,imperm,droll,purge,nibiru $code
done
BASE=batch-top.jsonl PREFIX=batch-top-x OUT=EXTENDERS-TOP node scripts/malice-extender-table.mjs > /dev/null
echo DONE
