import { BroadcastChannel } from './broadcast-channel';
import * as NativeMethod from './methods/native.js';
import * as IndexedDbMethod from './methods/indexed-db.js';
import * as LocalstorageMethod from './methods/localstorage.js';
import * as ServerMethod from './methods/server.js';
import * as SimulateMethod from './methods/simulate.js';


/**
 * The AdaptiveBroadcastChannel class is designed to add fallback to during channel post message and synchronization issues between senders and receivers in a broadcast communication scenario. It achieves this by:
 * Creating a separate channel for each communication method, allowing all methods to listen simultaneously.
 * Implementing adaptive listening, where all instances listen on all channels but primarily use the current active method for sending.
 * Enabling seamless method switching, allowing receivers to automatically adapt to the sender's method changes without manual intervention.
 */
export class RedudndantAdaptiveBroadcastChannel {
    constructor(name, options = {}) {
        this.name = name;
        this.options = options;
        this.closed = false;
        this.onML = null;
        // order from fastest to slowest
        this.methodPriority = [NativeMethod.type, IndexedDbMethod.type, LocalstorageMethod.type, ServerMethod.type];
        this.channels = new Map();
        this.listeners = new Set();
        this.processedNonces = new Set();
        this.nonce = 0;
        this.initChannels();
    }

    initChannels() {
        // only use simulate if type simulate ( for testing )
        if (this.options.type === SimulateMethod.type) {
            this.methodPriority = [SimulateMethod.type];
        }

        // iterates through the methodPriority array, attempting to create a new BroadcastChannel for each method
        this.methodPriority.forEach(method => {
            try {
                const channel = new BroadcastChannel(this.name, {
                    ...this.options,
                    type: method
                });
                this.channels.set(method, channel);
                // listening on every method
                channel.onmessage = (event) => this.handleMessage(event, method);
            } catch (error) {
                console.warn(`Failed to initialize ${method} method: ${error.message}`);
            }
        });

        if (this.channels.size === 0) {
            throw new Error('Failed to initialize any communication method');
        }
    }

    handleMessage(event, method) {
        if (event.data && event.data.nonce) {
            if (this.processedNonces.has(event.data.nonce)) {
                console.log(`Duplicate message received via ${method}, nonce: ${event.data.nonce}`);
                return;
            }
            this.processedNonces.add(event.data.nonce);

            // Cleanup old nonces (keeping last 1000 to prevent memory issues)
            if (this.processedNonces.size > 1000) {
                const oldestNonce = Math.min(...this.processedNonces);
                this.processedNonces.delete(oldestNonce);
            }

            this.listeners.forEach(listener => listener(event.data.message));
        }
    }

    async postMessage(message) {
        if (this.closed) {
            throw new Error(
                'AdaptiveBroadcastChannel.postMessage(): ' +
                'Cannot post message after channel has closed ' +
                /**
                 * In the past when this error appeared, it was realy hard to debug.
                 * So now we log the msg together with the error so it at least
                 * gives some clue about where in your application this happens.
                 */
                JSON.stringify(message)
            );
        }

        const nonce = this.generateNonce();
        const wrappedMessage = { nonce, message };

        const postPromises = Array.from(this.channels.entries()).map(([method, channel]) =>
            channel.postMessage(wrappedMessage).catch(error => {
                console.warn(`Failed to send via ${method}: ${error.message}`);
            })
        );

        await Promise.allSettled(postPromises);

        // Check if at least one promise resolved successfully
        const anySuccessful = postPromises.some(p => p.status === 'fulfilled');
        if (!anySuccessful) {
            throw new Error('Failed to send message through any method');
        }
    }

    generateNonce() {
        return `${Date.now()}-${this.nonce++}`;
    }

    set onmessage(fn) {
        this.removeEventListener('message', this.onML);
        if (fn && typeof fn === 'function') {
            this.onML = fn;
            this.addEventListener('message', fn);
        } else {
            this.onML = null;
        }
    }

    addEventListener(type, listener) {
        // type params is not being used, it's there to keep same interface as BroadcastChannel
        this.listeners.add(listener);
    }

    removeEventListener(type, listener) {
        // type params is not being used, it's there to keep same interface as BroadcastChannel
        this.listeners.delete(listener);
    }

    async close() {
        if (this.closed) {
            return;
        }

        this.onML = null;

        // use for loop instead of channels.values().map because of bug in safari Map
        const promises = [];
        for (const c of this.channels.values()) {
            promises.push(c.close());
        }
        await Promise.all(promises);

        this.channels.clear();
        this.listeners.clear();

        this.closed = true;
    }
}
