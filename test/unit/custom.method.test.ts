import AsyncTestUtil from "async-test-util";
import { describe, expect, it } from "vitest";

import { BroadcastChannel } from "../../src/index.js";

describe("unit/custom.method.test.js", () => {
  describe("custom methods", () => {
    it("should select provided method", () => {
      const channelName = AsyncTestUtil.randomString(12);
      const method = {
        type: "custom",
        canBeUsed: () => true,
        create: () => ({}),
      };
      const channel = new BroadcastChannel(channelName, { methods: method });
      expect(channel.method).toBe(method);
      channel.close();
    });
    it("should select one of the provided methods", () => {
      const channelName = AsyncTestUtil.randomString(12);
      const method = {
        type: "custom",
        canBeUsed: () => true,
        create: () => ({}),
        microSeconds: () => 0,
        postMessage: () => Promise.resolve(),
        onMessage: () => {},
        close: () => Promise.resolve(),
      };
      const channel = new BroadcastChannel(channelName, { methods: method });

      expect(channel.method).toBe(method);
      channel.close();
    });
  });
});
