// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import { claims } from "./claims.js";

for (const claim of claims) {
  test(claim.name, () => {
    assert.doesNotThrow(() => claim.verify(), claim.catches);
  });
}