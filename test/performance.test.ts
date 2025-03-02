import AsyncTestUtil from "async-test-util";
import { describe, it } from "vitest";

import { BroadcastChannel } from "../src/index.js";

const benchmark = {
  openClose: {},
  sendRecieve: {},
};

const options = {
  node: {
    useFastPath: false,
  },
  type: "simulate",
};

const elapsedTime = (before) => {
  return AsyncTestUtil.performanceNow() - before;
};

describe("performance.test.js", () => {
  // eslint-disable-next-line vitest/expect-expect
  it("wait a bit for jit etc..", async () => {
    await AsyncTestUtil.wait(2000);
  });

  // eslint-disable-next-line vitest/expect-expect
  it("open/close channels", async () => {
    const channelName = AsyncTestUtil.randomString(10);

    const amount = 110;
    const channels = [];

    const startTime = AsyncTestUtil.performanceNow();
    for (let i = 0; i < amount; i++) {
      const channel = new BroadcastChannel(channelName, options);
      channels.push(channel);
    }
    await Promise.all(channels.map((c) => c.close()));

    const elapsed = elapsedTime(startTime);
    benchmark.openClose = elapsed;
  });

  // eslint-disable-next-line vitest/expect-expect
  it("sendRecieve.parallel", async () => {
    const channelName = AsyncTestUtil.randomString(10);
    const channelSender = new BroadcastChannel(channelName, options);
    const channelReciever = new BroadcastChannel(channelName, options);
    const msgAmount = 2000;
    let emittedCount = 0;
    const waitPromise = new Promise((resolve) => {
      channelReciever.onmessage = () => {
        emittedCount++;
        if (emittedCount === msgAmount) {
          resolve();
        }
      };
    });

    const startTime = AsyncTestUtil.performanceNow();
    for (let i = 0; i < msgAmount; i++) {
      channelSender.postMessage("foobar");
    }
    await waitPromise;

    channelSender.close();
    channelReciever.close();

    const elapsed = elapsedTime(startTime);
    benchmark.sendRecieve.parallel = elapsed;
  });

  // eslint-disable-next-line vitest/expect-expect
  it("sendRecieve.series", { timeout: 10000 }, async () => {
    const channelName = AsyncTestUtil.randomString(10);
    const channelSender = new BroadcastChannel(channelName, options);
    const channelReciever = new BroadcastChannel(channelName, options);
    const msgAmount = 600;
    let emittedCount = 0;

    channelReciever.onmessage = () => {
      channelReciever.postMessage("pong");
    };

    const waitPromise = new Promise((resolve) => {
      channelSender.onmessage = () => {
        emittedCount++;
        if (emittedCount === msgAmount) {
          resolve();
        } else {
          channelSender.postMessage("ping");
        }
      };
    });

    const startTime = AsyncTestUtil.performanceNow();
    channelSender.postMessage("ping");
    await waitPromise;

    channelSender.close();
    channelReciever.close();

    const elapsed = elapsedTime(startTime);
    benchmark.sendRecieve.series = elapsed;
  });

  // eslint-disable-next-line vitest/expect-expect
  it("show result", () => {
    console.log("benchmark result:");
    console.log(JSON.stringify(benchmark, null, 2));
  });
});
