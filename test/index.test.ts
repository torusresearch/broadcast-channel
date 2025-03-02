import isNode from "detect-node";

if (!isNode) {
  // if browsers
  console.dir = (obj) => console.log(JSON.stringify(obj, null, 2));
}

import "./unit.test.ts";
import "./integration.test.ts";
import "./issues.test.ts";
