// Which data/c/<shard>.json holds a company: the low byte of the FNV-1a hash
// of its id. stillhiring/build.py computes the same value.
export function shardOf(id) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(id)) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }
  return (hash & 0xff).toString(16).padStart(2, "0");
}
