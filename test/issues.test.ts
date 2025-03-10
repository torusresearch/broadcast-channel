/* eslint-disable vitest/expect-expect */
import AsyncTestUtil from "async-test-util";
import isNode from "detect-node";
import { describe, expect, it } from "vitest";

import { BroadcastChannel } from "../src/index.js";

describe("issues.test.js", () => {
  it("#4 should throw when window.BroadcastChannel is overwritten", async () => {
    if (isNode) return; // only on browsers
    const bcBefore = window.BroadcastChannel;
    window.BroadcastChannel = BroadcastChannel;

    let bc;
    await expect(async () => {
      bc = new BroadcastChannel();
    }).rejects.toThrow("polyfill");

    if (bc) bc.close();

    // reset
    window.BroadcastChannel = bcBefore;
  });
  it("https://github.com/pubkey/rxdb/issues/852 if cleanup did not remove the info-file, it should not crash even if socket-file not exists", async () => {
    if (!isNode) return; // only on node
    const channelName = AsyncTestUtil.randomString(12);

    const channel1 = new BroadcastChannel(channelName);
    await channel1._prepP;

    // remove socket-file
    // we dont have socketEE in state.
    // fs.unlinkSync(channel1._state.socketEE.path);

    // send message over other channel
    const channel2 = new BroadcastChannel(channelName);
    await channel2.postMessage({
      foo: "bar",
    });

    await channel1.close();
    await channel2.close();
  });
  it("write many messages and then close", async () => {
    const channelName = AsyncTestUtil.randomString(12);
    const channel = new BroadcastChannel(channelName, { type: "simulate" });
    new Array(5000)
      .fill(0)
      .map((_i, idx) => ({
        foo: "bar",
        idx,
        longString: AsyncTestUtil.randomString(40),
      }))
      .map((msg) => channel.postMessage(msg));

    await channel.close();
  });
});
