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
export class AdaptiveBroadcastChannel {
    constructor(name, options = {}) {
        this.name = name;
        this.options = options;
        this.closed = false;
        this.onML = null;
        // order from fastest to slowest
        this.methodPriority = [NativeMethod.type, IndexedDbMethod.type, LocalstorageMethod.type, ServerMethod.type];
        this.currentMethodIndex = 0;
        this.channels = new Map();
        this.listeners = new Set();
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

    handleMessage(event) {
        this.listeners.forEach(listener => listener(event));
    }

    async postMessage(message, maxRetries = 4) {
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

        // attempt post message several times, fallback to next method if fail
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const currentMethod = this.methodPriority[this.currentMethodIndex];
            const channel = this.channels.get(currentMethod);

            if (!channel) {
                this.currentMethodIndex = (this.currentMethodIndex + 1) % this.methodPriority.length;
                continue;
            }

            try {
                if (this.options.postMessageFailUntilAttempt && attempt < this.options.postMessageFailUntilAttempt) {
                    // for testing purposes
                    throw new Error('Attempt fail manually');
                }
                await channel.postMessage(message);
                return; // Success, exit the function
            } catch (error) {
                if (error instanceof Error && error.message.toLowerCase().includes('closed')) {
                    // channel closed, don't continue fallback
                    throw error;
                }
                console.warn(`Attempt ${attempt + 1} failed on ${currentMethod}: ${error.message}`);

                // switch to next method
                this.currentMethodIndex = (this.currentMethodIndex + 1) % this.methodPriority.length;
                const newMethod = this.methodPriority[this.currentMethodIndex];
                console.warn(`Switched to method: ${newMethod}`);
            }
        }

        throw new Error('Failed to send message after all retries');
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
