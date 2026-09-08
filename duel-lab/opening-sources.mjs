import fs from 'node:fs';

// Explicit research sources only. Runtime checkpoints and unresolved draw
// frontiers must never become playable templates by directory discovery.
export function openingSources(){
  return ['malice-monsters','spell-starters','cyberse-starters','multi-malice','multi-cyberse',
    ...Array.from({length:8},(_,i)=>`pair-shard-${i}`),'multi-search-best']
    .filter(name=>fs.existsSync(new URL(`./routes/${name}.json`,import.meta.url)));
}
