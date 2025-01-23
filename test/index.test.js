import isNode from "detect-node";

if (!isNode) {
    // if browsers
    console.dir = (obj) => console.log(JSON.stringify(obj, null, 2));
}

import "./unit.test.js";
import "./integration.test.js";
import "./issues.test.js";
