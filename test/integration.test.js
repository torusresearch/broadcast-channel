const AsyncTestUtil = require('async-test-util');
const assert = require('assert');
const isNode = require('detect-node');
const clone = require('clone');
const unload = require('unload');
const { AdaptiveBroadcastChannel, BroadcastChannel, RedundantAdaptiveBroadcastChannel, OPEN_BROADCAST_CHANNELS, enforceOptions } = require('../');

if (isNode) {
    process.on('uncaughtException', (err, origin) => {
        console.error('uncaughtException!');
        console.dir(err);
        console.dir(origin);
        process.exit(1);
    });
}

// eslint-disable-next-line no-undef
const sandbox = sinon.createSandbox();

/**
 * we run this test once per method
 */
function runTest(channelOptions) {
    describe('integration.test.js (' + JSON.stringify(channelOptions) + ')', () => {
        describe('BroadcastChannel', () => {
            describe('.constructor()', () => {
                it('log options', () => {
                    console.log('Started: ' + JSON.stringify(channelOptions));
                });
                it('should create a channel', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);
                    channel.close();
                });
            });
            describe('.postMessage()', () => {
                it('should post a message', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);
                    await channel.postMessage('foobar');
                    channel.close();
                });
                it('should throw if channel is already closed', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);
                    channel.close();
                    await AsyncTestUtil.assertThrows(() => channel.postMessage('foobar'), Error, 'closed');
                });
            });
            describe('.close()', () => {
                it('should have resolved all processed message promises when close() resolves', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);

                    channel.postMessage({});
                    channel.postMessage({});
                    channel.postMessage({});

                    await channel.close();
                    assert.strictEqual(channel.isClosed, true);
                    assert.strictEqual(channel._uMP.size, 0);
                });
            });
            describe('.onmessage', () => {
                /**
                 * the window.BroadcastChannel
                 * does not emit postMessage to own subscribers,
                 * if you want to do that, you have to create another channel
                 */
                it('should NOT recieve the message on own', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);

                    const emitted = [];
                    channel.onmessage = (msg) => emitted.push(msg);
                    await channel.postMessage({
                        foo: 'bar',
                    });

                    await AsyncTestUtil.wait(100);
                    assert.equal(emitted.length, 0);

                    channel.close();
                });
                it('should recieve the message on other channel', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);
                    const otherChannel = new BroadcastChannel(channelName, channelOptions);

                    const emitted = [];
                    otherChannel.onmessage = (msg) => emitted.push(msg);
                    await channel.postMessage({
                        foo: 'bar',
                    });
                    await AsyncTestUtil.waitUntil(() => emitted.length === 1);
                    assert.equal(emitted[0].foo, 'bar');
                    channel.close();
                    otherChannel.close();
                });
                it('should work with strange channelName', async () => {
                    const channelName = '  asdf  / ' + AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);
                    const otherChannel = new BroadcastChannel(channelName, channelOptions);

                    const emitted = [];
                    otherChannel.onmessage = (msg) => emitted.push(msg);
                    await channel.postMessage({
                        foo: 'bar',
                    });
                    await AsyncTestUtil.waitUntil(() => emitted.length === 1);
                    assert.equal(emitted[0].foo, 'bar');
                    channel.close();
                    otherChannel.close();
                });
                it('should have the same message-data', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel1 = new BroadcastChannel(channelName, channelOptions);
                    const channel2 = new BroadcastChannel(channelName, channelOptions);

                    const emitted = [];
                    channel2.onmessage = (msg) => emitted.push(msg);

                    const msgJson = {
                        foo: 'bar',
                    };
                    await channel1.postMessage(msgJson);

                    await AsyncTestUtil.waitUntil(() => emitted.length === 1);
                    assert.deepEqual(emitted[0], msgJson);

                    channel1.close();
                    channel2.close();
                });
                it('should work with big message-data', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel1 = new BroadcastChannel(channelName, channelOptions);
                    const channel2 = new BroadcastChannel(channelName, channelOptions);

                    const emitted = [];
                    channel2.onmessage = (msg) => emitted.push(msg);

                    const msgJson = {
                        one: AsyncTestUtil.randomString(1000),
                        two: AsyncTestUtil.randomString(1000),
                        three: AsyncTestUtil.randomString(1000),
                    };
                    await channel1.postMessage(msgJson);

                    await AsyncTestUtil.waitUntil(() => emitted.length === 1);
                    assert.deepEqual(emitted[0], msgJson);

                    channel1.close();
                    channel2.close();
                });
                it('should not loose the message if _prepare() takes a while', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const slowerOptions = clone(channelOptions);
                    slowerOptions.prepareDelay = 300;
                    const channel1 = new BroadcastChannel(channelName, channelOptions);
                    const channel2 = new BroadcastChannel(channelName, slowerOptions);

                    const emitted = [];
                    channel2.onmessage = (msg) => emitted.push(msg);

                    const msgJson = {
                        foo: 'bar',
                    };
                    await channel1.postMessage(msgJson);

                    await AsyncTestUtil.waitUntil(() => emitted.length === 1);
                    assert.deepEqual(emitted[0], msgJson);

                    channel1.close();
                    channel2.close();
                });
                it('should NOT emit all events if subscribed directly after postMessage', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel1 = new BroadcastChannel(channelName, channelOptions);
                    const channel2 = new BroadcastChannel(channelName, channelOptions);

                    channel1.postMessage('foo1');
                    channel1.postMessage('foo2');

                    /**
                     * We have to wait 200ms here because only 'too old' messages should be filtered out.
                     * Becuase the JavaScript time precision is not good enough, we also emit messages that are only a bit off.
                     * This ensures we do not miss out messages which would be way more critical then getting additionals.
                     */
                    await AsyncTestUtil.wait(200);

                    const emitted = [];
                    channel2.onmessage = (msg) => emitted.push(msg);

                    channel1.postMessage('foo3');

                    await AsyncTestUtil.waitUntil(() => emitted.length >= 1);
                    await AsyncTestUtil.wait(100);
                    assert.equal(emitted.length, 1);

                    channel1.close();
                    channel2.close();
                });
                it('should not emit messages, send before onmessage was set, when one tick was done', async () => {
                    const channelName = AsyncTestUtil.randomString(12);

                    const channel1 = new BroadcastChannel(channelName, channelOptions);
                    const channel2 = new BroadcastChannel(channelName, channelOptions);

                    channel1.postMessage('foo1');
                    channel1.postMessage('foo2');

                    await AsyncTestUtil.wait(50);

                    const emitted = [];
                    channel2.onmessage = (msg) => emitted.push(msg);

                    const msgJson = {
                        foo: 'bar',
                    };
                    channel1.postMessage(msgJson);

                    await AsyncTestUtil.waitUntil(() => emitted.length >= 1);
                    assert.equal(emitted.length, 1);
                    assert.deepEqual(emitted[0], msgJson);

                    channel1.close();
                    channel2.close();
                });
                it('should not confuse messages between different channels', async () => {
                    const channel = new BroadcastChannel(AsyncTestUtil.randomString(12), channelOptions);
                    const otherChannel = new BroadcastChannel(AsyncTestUtil.randomString(12), channelOptions);

                    const emitted = [];
                    otherChannel.onmessage = (msg) => emitted.push(msg);
                    await channel.postMessage({
                        foo: 'bar',
                    });
                    await AsyncTestUtil.wait(100);
                    assert.equal(emitted.length, 0);

                    channel.close();
                    otherChannel.close();
                });
                it('should not read messages created before the channel was created', async () => {
                    await AsyncTestUtil.wait(100);

                    const channelName = AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);

                    await channel.postMessage('foo1');
                    await AsyncTestUtil.wait(50);

                    const otherChannel = new BroadcastChannel(channelName, channelOptions);
                    const emittedOther = [];
                    otherChannel.onmessage = (msg) => emittedOther.push(msg);

                    await channel.postMessage('foo2');
                    await channel.postMessage('foo3');

                    await AsyncTestUtil.waitUntil(() => emittedOther.length >= 2);
                    await AsyncTestUtil.wait(100);

                    assert.equal(emittedOther.length, 2);

                    channel.close();
                    otherChannel.close();
                });
                it('should only run the last onmessage-callback', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);
                    const channel2 = new BroadcastChannel(channelName, channelOptions);

                    const emitted1 = [];
                    const emitted2 = [];

                    channel2.onmessage = (msg) => {
                        emitted1.push(msg);
                    };
                    channel2.onmessage = (msg) => {
                        emitted2.push(msg);
                    };

                    await channel.postMessage('foobar');

                    await AsyncTestUtil.waitUntil(() => emitted2.length >= 1);
                    await AsyncTestUtil.wait(100);

                    assert.equal(emitted1.length, 0);
                    assert.equal(emitted2.length, 1);

                    channel.close();
                    channel2.close();
                });
            });
            describe('.addEventListener()', () => {
                it('should emit events to all subscribers', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);
                    const otherChannel = new BroadcastChannel(channelName, channelOptions);

                    const emitted1 = [];
                    const emitted2 = [];

                    otherChannel.addEventListener('message', (msg) => emitted1.push(msg));
                    otherChannel.addEventListener('message', (msg) => emitted2.push(msg));

                    const msg = {
                        foo: 'bar',
                    };
                    await channel.postMessage(msg);

                    await AsyncTestUtil.waitUntil(() => emitted1.length === 1);
                    await AsyncTestUtil.waitUntil(() => emitted2.length === 1);

                    assert.deepEqual(msg, emitted1[0]);
                    assert.deepEqual(msg, emitted2[0]);

                    channel.close();
                    otherChannel.close();
                });
            });
            describe('.removeEventListener()', () => {
                it('should no longer emit the message', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);
                    const otherChannel = new BroadcastChannel(channelName, channelOptions);

                    const emitted = [];
                    const fn = (msg) => emitted.push(msg);
                    otherChannel.addEventListener('message', fn);

                    const msg = {
                        foo: 'bar',
                    };
                    await channel.postMessage(msg);

                    await AsyncTestUtil.waitUntil(() => emitted.length === 1);

                    otherChannel.removeEventListener('message', fn);

                    await channel.postMessage(msg);
                    await AsyncTestUtil.wait(100);

                    assert.equal(emitted.length, 1);

                    channel.close();
                    otherChannel.close();
                });
            });
            describe('.type', () => {
                it('should get a type', async () => {
                    const channel = new BroadcastChannel(AsyncTestUtil.randomString(12), channelOptions);
                    const type = channel.type;
                    assert.equal(typeof type, 'string');
                    assert.notEqual(type, '');
                    assert.equal(channel.type, channelOptions.type);

                    channel.close();
                });
            });
            describe('.enforceOptions()', () => {
                it('should enforce the simulate method, even when ' + channelOptions.type + ' is set', async () => {
                    enforceOptions({
                        type: 'simulate',
                    });
                    const channel = new BroadcastChannel(AsyncTestUtil.randomString(12), channelOptions);

                    assert.equal(channel.type, 'simulate');

                    channel.close();
                });
                it('should redo the enforcement when null is given', async () => {
                    enforceOptions(null);
                    const channel = new BroadcastChannel(AsyncTestUtil.randomString(12), channelOptions);
                    assert.equal(channel.type, channelOptions.type);

                    channel.close();
                });
            });
            describe('other', () => {
                it('should prefer localstorage if webWorkerSupport: false', async () => {
                    if (isNode) return;
                    // disable BroadcastChannel
                    const broadcastChannelBefore = window.BroadcastChannel;
                    Object.defineProperty(window, 'BroadcastChannel', {
                        enumerable: false,
                        configurable: false,
                        writable: true,
                        value: false,
                    });

                    const options = {
                        webWorkerSupport: false,
                    };
                    const channel = new BroadcastChannel(AsyncTestUtil.randomString(12), options);
                    assert.equal(channel.type, 'localstorage');

                    window.BroadcastChannel = broadcastChannelBefore;
                });
                it('should always emit in the correct order', async () => {
                    const channelName = AsyncTestUtil.randomString(12);
                    const channel = new BroadcastChannel(channelName, channelOptions);
                    const otherChannel = new BroadcastChannel(channelName, channelOptions);

                    const emitted = [];
                    otherChannel.onmessage = (msg) => emitted.push(msg);

                    const amount = 300;
                    let nr = 0;
                    new Array(amount).fill(0).forEach(() => {
                        channel.postMessage({
                            nr,
                            long: AsyncTestUtil.randomString(512),
                        });
                        nr++;
                    });

                    await AsyncTestUtil.waitUntil(() => emitted.length === amount);

                    let checkNr = 0;
                    emitted.forEach((msg) => {
                        assert.equal(checkNr, msg.nr);
                        checkNr++;
                    });

                    channel.close();
                    otherChannel.close();
                });
            });
            describe('ISSUES', () => {
                it('#6 premature closing of the channel should not throw', async () => {
                    const channels = [];
                    for (let i = 0; i < 10; i++) {
                        const channel = new BroadcastChannel(AsyncTestUtil.randomString(12), channelOptions);
                        unload.runAll();
                        channels.push(channel);
                    }
                    channels.forEach((channel) => channel.close());
                });
            });
        });
    });
    describe('final', () => {
        it('should have closed all channels', () => {
            if (isNode) {
                assert.strictEqual(OPEN_BROADCAST_CHANNELS.size, 0);
            }
        });
    });
}

const useOptions = [
    {
        type: 'simulate',
    },
];

if (!isNode) {
    if (window.BroadcastChannel) {
        useOptions.push({
            type: 'native',
        });
    } else {
        console.log('skip native option since windonw.BroadcastChannel is undefined');
    }
    useOptions.push({
        type: 'idb',
    });
    useOptions.push({
        type: 'localstorage',
    });
}

useOptions.forEach((o) => runTest(o));

describe('RedundantAdaptiveBroadcastChannel', () => {
    afterEach(function () {
        sandbox.restore();
    });

    describe('.constructor()', () => {
        it('log options', () => {
            console.log('Started: ' + JSON.stringify({}));
        });
        it('should create a channel', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);
            await channel.close();
        });
    });

    describe('.postMessage()', () => {
        it('should post a message', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);
            await channel.postMessage('foobar');
            await channel.close();
        });
        it('should throw if channel is already closed', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);
            await channel.close();
            await AsyncTestUtil.assertThrows(() => channel.postMessage('foobar'), Error, 'closed');
        });
    });

    describe('adaptive post message', () => {
        it('should still receive message if 1 channel post fail with error', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);
            const otherChannel = new RedundantAdaptiveBroadcastChannel(channelName);

            // native channel post message fail
            const nativeChannel = channel.channels.get('native');
            sandbox.stub(nativeChannel, 'postMessage').rejects(new Error('test'));

            const emitted = [];
            otherChannel.onmessage = (msg) => emitted.push(msg);
            await channel.postMessage({
                foo: 'bar',
            });
            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.equal(emitted[0].foo, 'bar');
            await channel.close();
            await otherChannel.close();
        });

        it('should still receive message if multiple channels post fail with error', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);
            const otherChannel = new RedundantAdaptiveBroadcastChannel(channelName);

            // fail these channels
            const failChannels = ['native', 'idb', 'localstorage'];
            for (const [type, c] of channel.channels.entries()) {
                if (failChannels.includes(type)) {
                    sandbox.stub(c, 'postMessage').rejects(new Error('test'));
                }
            }

            const emitted = [];
            otherChannel.onmessage = (msg) => emitted.push(msg);
            await channel.postMessage({
                foo: 'bar',
            });
            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.equal(emitted[0].foo, 'bar');
            await channel.close();
            await otherChannel.close();
        });

        it('should still receive message if 1 channel post fail silently', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);
            const otherChannel = new RedundantAdaptiveBroadcastChannel(channelName);

            // native channel post message fail
            const nativeChannel = channel.channels.get('native');
            sandbox.stub(nativeChannel, 'postMessage').resolves(null);

            const emitted = [];
            otherChannel.onmessage = (msg) => emitted.push(msg);
            await channel.postMessage({
                foo: 'bar',
            });
            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.equal(emitted[0].foo, 'bar');
            await channel.close();
            await otherChannel.close();
        });

        it('should still receive message if multiple channels post fail silently', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);
            const otherChannel = new RedundantAdaptiveBroadcastChannel(channelName);

            // fail these channels
            const failChannels = ['native', 'idb', 'localstorage'];
            for (const [type, c] of channel.channels.entries()) {
                if (failChannels.includes(type)) {
                    sandbox.stub(c, 'postMessage').resolves(null);
                }
            }

            const emitted = [];
            otherChannel.onmessage = (msg) => emitted.push(msg);
            await channel.postMessage({
                foo: 'bar',
            });
            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.equal(emitted[0].foo, 'bar');
            await channel.close();
            await otherChannel.close();
        });
    });

    describe('.onmessage', () => {
        /**
         * the window.BroadcastChannel
         * does not emit postMessage to own subscribers,
         * if you want to do that, you have to create another channel
         */
        it('should NOT receive the message on own', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);

            const emitted = [];
            channel.onmessage = (msg) => emitted.push(msg);
            await channel.postMessage({
                foo: 'bar',
            });

            await AsyncTestUtil.wait(100);
            assert.equal(emitted.length, 0);

            await channel.close();
        });
        it('should receive the message on other channel', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);
            const otherChannel = new RedundantAdaptiveBroadcastChannel(channelName);

            const emitted = [];
            otherChannel.onmessage = (msg) => emitted.push(msg);
            await channel.postMessage({
                foo: 'bar',
            });
            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.equal(emitted[0].foo, 'bar');
            await channel.close();
            await otherChannel.close();
        });
    });

    describe('.close()', () => {
        it('should have resolved all processed message promises when close() resolves', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);

            channel.postMessage({});
            channel.postMessage({});
            channel.postMessage({});

            await channel.close();
            for (const c in channel.channels.values()) {
                assert.strictEqual(c.isClosed, true);
                assert.strictEqual(c._uMP.size, 0);
            }
        });
    });

    describe('.addEventListener()', () => {
        it('should emit events to all subscribers', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);
            const otherChannel = new RedundantAdaptiveBroadcastChannel(channelName);

            const emitted1 = [];
            const emitted2 = [];

            otherChannel.addEventListener('message', (msg) => emitted1.push(msg));
            otherChannel.addEventListener('message', (msg) => emitted2.push(msg));

            const msg = {
                foo: 'bar',
            };
            await channel.postMessage(msg);

            await AsyncTestUtil.waitUntil(() => emitted1.length === 1);
            await AsyncTestUtil.waitUntil(() => emitted2.length === 1);

            assert.deepEqual(msg, emitted1[0]);
            assert.deepEqual(msg, emitted2[0]);

            await channel.close();
            await otherChannel.close();
        });
    });

    describe('.removeEventListener()', () => {
        it('should no longer emit the message', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new RedundantAdaptiveBroadcastChannel(channelName);
            const otherChannel = new RedundantAdaptiveBroadcastChannel(channelName);

            const emitted = [];
            const fn = (msg) => emitted.push(msg);
            otherChannel.addEventListener('message', fn);

            const msg = {
                foo: 'bar',
            };
            await channel.postMessage(msg);

            await AsyncTestUtil.waitUntil(() => emitted.length === 1);

            otherChannel.removeEventListener('message', fn);

            await channel.postMessage(msg);
            await AsyncTestUtil.wait(100);

            assert.equal(emitted.length, 1);

            await channel.close();
            await otherChannel.close();
        });
    });
});

describe('AdaptiveBroadcastChannel', () => {
    describe('.constructor()', () => {
        it('log options', () => {
            console.log('Started: ' + JSON.stringify({}));
        });
        it('should create a channel', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName);
            await channel.close();
        });
    });

    describe('.postMessage()', () => {
        it('should post a message', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName);
            await channel.postMessage('foobar');
            await channel.close();
        });
        it('should throw if channel is already closed', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName);
            await channel.close();
            await AsyncTestUtil.assertThrows(() => channel.postMessage('foobar'), Error, 'closed');
        });
    });

    describe('fallback', () => {
        it('should fallback to next method on message send fail', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName, {
                postMessageFailUntilAttempt: 1
            });
            const otherChannel = new AdaptiveBroadcastChannel(channelName);

            const emitted = [];
            otherChannel.onmessage = (msg) => emitted.push(msg);
            // post success on attempt 2 => indexedDb method
            await channel.postMessage({
                foo: 'bar',
            });

            // sender channel should fallback to next method
            assert.equal(channel.currentMethodIndex, 1);
            assert.equal(channel.methodPriority[channel.currentMethodIndex], 'idb');

            // listen channel should still receive message
            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.equal(emitted[0].foo, 'bar');
            await channel.close();
            await otherChannel.close();
        });
        it('should fallback to the last method (server) on send fail', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName, {
                postMessageFailUntilAttempt: 3
            });
            const otherChannel = new AdaptiveBroadcastChannel(channelName);

            const emitted = [];
            otherChannel.onmessage = (msg) => emitted.push(msg);
            // post success on attempt 2 => indexedDb method
            await channel.postMessage({
                foo: 'bar',
            });

            // sender channel should fallback to next method
            assert.equal(channel.currentMethodIndex, 3);
            assert.equal(channel.methodPriority[channel.currentMethodIndex], 'server');

            // listen channel should still receive message
            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.equal(emitted[0].foo, 'bar');
            await channel.close();
            await otherChannel.close();
        });

        it('should throw error if all attempt fail pass retries', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName, {
                postMessageFailUntilAttempt: 3
            });

            await AsyncTestUtil.assertThrows(() => channel.postMessage('foobar', 1), Error, 'Failed to send message');
            await channel.close();
        });
    });

    describe('.close()', () => {
        it('should have resolved all processed message promises when close() resolves', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName);

            channel.postMessage({});
            channel.postMessage({});
            channel.postMessage({});

            await channel.close();
            for (const c in channel.channels.values()) {
                assert.strictEqual(c.isClosed, true);
                assert.strictEqual(c._uMP.size, 0);
            }
        });
    });

    describe('.onmessage', () => {
        /**
         * the window.BroadcastChannel
         * does not emit postMessage to own subscribers,
         * if you want to do that, you have to create another channel
         */
        it('should NOT recieve the message on own', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName);

            const emitted = [];
            channel.onmessage = (msg) => emitted.push(msg);
            await channel.postMessage({
                foo: 'bar',
            });

            await AsyncTestUtil.wait(100);
            assert.equal(emitted.length, 0);

            await channel.close();
        });
        it('should recieve the message on other channel', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName);
            const otherChannel = new AdaptiveBroadcastChannel(channelName);

            const emitted = [];
            otherChannel.onmessage = (msg) => emitted.push(msg);
            await channel.postMessage({
                foo: 'bar',
            });
            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.equal(emitted[0].foo, 'bar');
            await channel.close();
            await otherChannel.close();
        });
        it('should work with strange channelName', async () => {
            const channelName = '  asdf  / ' + AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName);
            const otherChannel = new AdaptiveBroadcastChannel(channelName);

            const emitted = [];
            otherChannel.onmessage = (msg) => emitted.push(msg);
            await channel.postMessage({
                foo: 'bar',
            });
            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.equal(emitted[0].foo, 'bar');
            await channel.close();
            await otherChannel.close();
        });
        it('should have the same message-data', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel1 = new AdaptiveBroadcastChannel(channelName);
            const channel2 = new AdaptiveBroadcastChannel(channelName);

            const emitted = [];
            channel2.onmessage = (msg) => emitted.push(msg);

            const msgJson = {
                foo: 'bar',
            };
            await channel1.postMessage(msgJson);

            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.deepEqual(emitted[0], msgJson);

            await channel1.close();
            await channel2.close();
        });
        it('should work with big message-data', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel1 = new AdaptiveBroadcastChannel(channelName);
            const channel2 = new AdaptiveBroadcastChannel(channelName);

            const emitted = [];
            channel2.onmessage = (msg) => emitted.push(msg);

            const msgJson = {
                one: AsyncTestUtil.randomString(1000),
                two: AsyncTestUtil.randomString(1000),
                three: AsyncTestUtil.randomString(1000),
            };
            await channel1.postMessage(msgJson);

            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.deepEqual(emitted[0], msgJson);

            await channel1.close();
            await channel2.close();
        });
        it('should not loose the message if _prepare() takes a while', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const slowerOptions = {};
            slowerOptions.prepareDelay = 300;
            const channel1 = new AdaptiveBroadcastChannel(channelName, {});
            const channel2 = new AdaptiveBroadcastChannel(channelName, slowerOptions);

            const emitted = [];
            channel2.onmessage = (msg) => emitted.push(msg);

            const msgJson = {
                foo: 'bar',
            };
            await channel1.postMessage(msgJson);

            await AsyncTestUtil.waitUntil(() => emitted.length === 1);
            assert.deepEqual(emitted[0], msgJson);

            await channel1.close();
            await channel2.close();
        });
        it('should NOT emit all events if subscribed directly after postMessage', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel1 = new AdaptiveBroadcastChannel(channelName);
            const channel2 = new AdaptiveBroadcastChannel(channelName);

            channel1.postMessage('foo1');
            channel1.postMessage('foo2');

            /**
             * We have to wait 200ms here because only 'too old' messages should be filtered out.
             * Becuase the JavaScript time precision is not good enough, we also emit messages that are only a bit off.
             * This ensures we do not miss out messages which would be way more critical then getting additionals.
             */
            await AsyncTestUtil.wait(200);

            const emitted = [];
            channel2.onmessage = (msg) => emitted.push(msg);

            channel1.postMessage('foo3');

            await AsyncTestUtil.waitUntil(() => emitted.length >= 1);
            await AsyncTestUtil.wait(100);
            assert.equal(emitted.length, 1);

            await channel1.close();
            await channel2.close();
        });
        it('should not emit messages, send before onmessage was set, when one tick was done', async () => {
            const channelName = AsyncTestUtil.randomString(12);

            const channel1 = new AdaptiveBroadcastChannel(channelName);
            const channel2 = new AdaptiveBroadcastChannel(channelName);

            channel1.postMessage('foo1');
            channel1.postMessage('foo2');

            await AsyncTestUtil.wait(50);

            const emitted = [];
            channel2.onmessage = (msg) => emitted.push(msg);

            const msgJson = {
                foo: 'bar',
            };
            channel1.postMessage(msgJson);

            await AsyncTestUtil.waitUntil(() => emitted.length >= 1);
            assert.equal(emitted.length, 1);
            assert.deepEqual(emitted[0], msgJson);

            await channel1.close();
            await channel2.close();
        });
        it('should not confuse messages between different channels', async () => {
            const channel = new AdaptiveBroadcastChannel(AsyncTestUtil.randomString(12));
            const otherChannel = new AdaptiveBroadcastChannel(AsyncTestUtil.randomString(12));

            const emitted = [];
            otherChannel.onmessage = (msg) => emitted.push(msg);
            await channel.postMessage({
                foo: 'bar',
            });
            await AsyncTestUtil.wait(100);
            assert.equal(emitted.length, 0);

            await channel.close();
            await otherChannel.close();
        });
        it('should not read messages created before the channel was created', async () => {
            await AsyncTestUtil.wait(100);

            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName);

            await channel.postMessage('foo1');
            await AsyncTestUtil.wait(50);

            const otherChannel = new AdaptiveBroadcastChannel(channelName);
            const emittedOther = [];
            otherChannel.onmessage = (msg) => emittedOther.push(msg);

            await channel.postMessage('foo2');
            await channel.postMessage('foo3');

            await AsyncTestUtil.waitUntil(() => emittedOther.length >= 2);
            await AsyncTestUtil.wait(100);

            assert.equal(emittedOther.length, 2);

            await channel.close();
            await otherChannel.close();
        });
        it('should only run the last onmessage-callback', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName);
            const channel2 = new AdaptiveBroadcastChannel(channelName);

            const emitted1 = [];
            const emitted2 = [];

            channel2.onmessage = (msg) => {
                emitted1.push(msg);
            };
            channel2.onmessage = (msg) => {
                emitted2.push(msg);
            };

            await channel.postMessage('foobar');

            await AsyncTestUtil.waitUntil(() => emitted2.length >= 1);
            await AsyncTestUtil.wait(100);

            assert.equal(emitted1.length, 0);
            assert.equal(emitted2.length, 1);

            await channel.close();
            await channel2.close();
        });
    });

    describe('.addEventListener()', () => {
        it('should emit events to all subscribers', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName);
            const otherChannel = new AdaptiveBroadcastChannel(channelName);

            const emitted1 = [];
            const emitted2 = [];

            otherChannel.addEventListener('message', (msg) => emitted1.push(msg));
            otherChannel.addEventListener('message', (msg) => emitted2.push(msg));

            const msg = {
                foo: 'bar',
            };
            await channel.postMessage(msg);

            await AsyncTestUtil.waitUntil(() => emitted1.length === 1);
            await AsyncTestUtil.waitUntil(() => emitted2.length === 1);

            assert.deepEqual(msg, emitted1[0]);
            assert.deepEqual(msg, emitted2[0]);

            await channel.close();
            await otherChannel.close();
        });
    });

    describe('.removeEventListener()', () => {
        it('should no longer emit the message', async () => {
            const channelName = AsyncTestUtil.randomString(12);
            const channel = new AdaptiveBroadcastChannel(channelName);
            const otherChannel = new AdaptiveBroadcastChannel(channelName);

            const emitted = [];
            const fn = (msg) => emitted.push(msg);
            otherChannel.addEventListener('message', fn);

            const msg = {
                foo: 'bar',
            };
            await channel.postMessage(msg);

            await AsyncTestUtil.waitUntil(() => emitted.length === 1);

            otherChannel.removeEventListener('message', fn);

            await channel.postMessage(msg);
            await AsyncTestUtil.wait(100);

            assert.equal(emitted.length, 1);

            await channel.close();
            await otherChannel.close();
        });
    });

    describe('.enforceOptions()', () => {
        it('should enforce the simulate method to all channels', async () => {
            enforceOptions({
                type: 'simulate',
            });
            const channel = new AdaptiveBroadcastChannel(AsyncTestUtil.randomString(12));

            for (const c of channel.channels.values()) {
                assert.equal(c.type, 'simulate');
            }

            await channel.close();
        });
        it('should redo the enforcement when null is given', async () => {
            enforceOptions(null);
            const channel = new AdaptiveBroadcastChannel(AsyncTestUtil.randomString(12));
            for (const c of channel.channels.values()) {
                assert.notEqual(c.type, 'simulate');
            }

            await channel.close();
        });
    });
});
