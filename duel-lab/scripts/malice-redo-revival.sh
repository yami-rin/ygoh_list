#!/usr/bin/env bash
# Redo the results affected by the revival-limit scoring fix (see scripts/malice-drop-inflated.mjs). Run from duel-lab/.
set -e
R=runtime/malice
CHANGED="malice-open-68337209-74652966 malice-open-32061192-74652966"
# 1. Catalog lines for UG+Soul and Dormouse+Soul, then rebuild the saved routes.
node scripts/malice-catalog.mjs 300
node scripts/malice-catalog-save.mjs
# 2. Hand-trap tables of the recommended routes whose steps changed.
for id in $CHANGED; do grep -v "\"routeId\":\"$id\"" $R/batch-top.jsonl > $R/batch-top.tmp || true; mv $R/batch-top.tmp $R/batch-top.jsonl; done
node scripts/malice-hits.mjs ash,imperm,droll,purge,nibiru malice-open-68337209-74652966,malice-open-32061192-74652966,malice-open-68337209-30118811 -top
HITS_TAG=-top node scripts/malice-batch.mjs $R/batch-top.jsonl 60 ash,imperm,droll,purge,nibiru
cat $R/batch-saved.jsonl $R/batch-top.jsonl > $R/recommended.jsonl
# 3. Calibration of the changed routes.
for id in $CHANGED; do grep -v "\"id\":\"$id\"" $R/calibrate-user-mirror.jsonl > $R/cal.tmp || true; mv $R/cal.tmp $R/calibrate-user-mirror.jsonl; done
node scripts/malice-calibrate.mjs 200 user-mirror
# 4. Sample rows that were removed.
node scripts/malice-sample.mjs 80 120
for t in ash imperm nibiru purge; do node scripts/malice-sample.mjs 40 90 $t; done
echo DONE
