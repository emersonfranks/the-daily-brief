// @ts-check

import test from "node:test";
import { claims } from "./claims.js";

for (const claim of claims) {
  test(claim.name, () => claim.verify());
}