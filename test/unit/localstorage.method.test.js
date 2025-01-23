import AsyncTestUtil from "async-test-util";
import isNode from "detect-node";
import { describe, expect, it } from "vitest";

import { LocalstorageMethod as LocalStorageMethod } from "../../src/index.js";

describe("unit/localstorage.method.test.js", () => {
    if (isNode) return;

    describe(".getLocalStorage()", () => {
        it("should always get a object", () => {
            const ls = LocalStorageMethod.getLocalStorage();
            expect(ls).toBeTruthy();
            expect(typeof ls.setItem).toBe("function");
        });
    });

    describe(".postMessage()", () => {
        it("should set the message", async () => {
            const channelState = {
                channelName: AsyncTestUtil.randomString(10),
                uuid: AsyncTestUtil.randomString(10),
            };
            const json = { foo: "bar" };
            await LocalStorageMethod.postMessage(channelState, json);
            const ls = LocalStorageMethod.getLocalStorage();
            const key = LocalStorageMethod.storageKey(channelState.channelName);
            const value = JSON.parse(ls.getItem(key));
            expect(value.data.foo).toBe("bar");
        });

        it("should fire an event", async () => {
            const channelState = {
                channelName: AsyncTestUtil.randomString(10),
                uuid: AsyncTestUtil.randomString(10),
            };
            const json = { foo: "bar" };

            const emitted = [];
            const listener = LocalStorageMethod.addStorageEventListener(channelState.channelName, (ev) => {
                emitted.push(ev);
            });

            LocalStorageMethod.postMessage(channelState, json);

            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            expect(emitted[0].data.foo).toBe("bar");

            LocalStorageMethod.removeStorageEventListener(listener);
        });
    });

    describe(".create()", () => {
        it("create an instance", async () => {
            const channelName = AsyncTestUtil.randomString(10);
            const state = LocalStorageMethod.create(channelName);
            expect(state.uuid).toBeTruthy();
            LocalStorageMethod.close(state);
        });
    });

    describe(".onMessage()", () => {
        it("should emit to the other channel", async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channelState1 = await LocalStorageMethod.create(channelName);
            const channelState2 = await LocalStorageMethod.create(channelName);

            const emitted = [];
            LocalStorageMethod.onMessage(
                channelState2,
                (msg) => {
                    emitted.push(msg);
                    console.log("was emitted");
                },
                new Date().getTime()
            );
            const json = {
                foo: "bar",
            };
            LocalStorageMethod.postMessage(channelState1, json);

            await AsyncTestUtil.waitUntil(() => emitted.length === 1);

            expect(emitted[0]).toEqual(json);

            LocalStorageMethod.close(channelState1);
            LocalStorageMethod.close(channelState2);
        });
    });
});
