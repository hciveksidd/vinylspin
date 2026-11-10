import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { shardOf } from "../../site/shard.js";

const cases = JSON.parse(readFileSync(new URL("../cases/shards.json", import.meta.url), "utf8"));

test("shardOf agrees with the pipeline", () => {
  for (const { id, shard } of cases) assert.equal(shardOf(id), shard, id);
});
