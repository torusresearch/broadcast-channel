/* eslint-disable @typescript-eslint/no-use-before-define */
import { chooseMethod } from "./method-chooser";
import { fillOptionsWithDefaults } from "./options";
import { AddEventListeners, EventType, ListenerObject, MessageObject, Method, Options as BroadcastChannelOptions } from "./types";
import { isPromise, PROMISE_RESOLVED_VOID } from "./util";

let ENFORCED_OPTIONS: BroadcastChannelOptions | undefined;

export function enforceOptions(options: BroadcastChannelOptions): void {
  ENFORCED_OPTIONS = options;
}

/**
 * Contains all open channels,
 * used in tests to ensure everything is closed.
 */
// eslint-disable-next-line no-use-before-define
export const OPEN_BROADCAST_CHANNELS = new Set<BroadcastChannel>();
let lastId = 0;

export class BroadcastChannel {
  static _pubkey = true;

  public id: number;

  public name: string;

  public options: BroadcastChannelOptions;

  public method: Method;

  public closed: boolean;

  _addEL: AddEventListeners;

  _prepP: Promise<unknown> | null; // preparePromise

  _state: unknown;

  _uMP: Set<Promise<unknown>>; // unsent message promises

  _iL: boolean; // isListening

  private _onML: ListenerObject | null; // onMessageListener

  private _befC: Array<() => Promise<void>>; // beforeClose

  constructor(name: string, options?: BroadcastChannelOptions) {
    this.id = lastId++;
    OPEN_BROADCAST_CHANNELS.add(this);
    this.name = name;

    if (ENFORCED_OPTIONS) {
      options = ENFORCED_OPTIONS;
    }
    this.options = fillOptionsWithDefaults(options || {});
    this.method = chooseMethod(this.options);
    this.closed = false;

    this._iL = false;
    this._onML = null;
    this._addEL = {
      message: [],
      internal: [],
    };
    this._uMP = new Set();
    this._befC = [];
    this._prepP = null;
    _prepareChannel(this);
  }

  get type(): string {
    return this.method.type;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  // eslint-disable-next-line accessor-pairs
  set onmessage(fn: ((data: unknown) => void) | null) {
    const time = this.method.microSeconds();
    const listenObj: ListenerObject = {
      time,
      fn: fn as (data: unknown) => void,
    };
    _removeListenerObject(this, "message", this._onML);
    if (fn && typeof fn === "function") {
      this._onML = listenObj;
      _addListenerObject(this, "message", listenObj);
    } else {
      this._onML = null;
    }
  }

  postMessage(msg: unknown): Promise<unknown> {
    if (this.closed) {
      throw new Error(`BroadcastChannel.postMessage(): ` + `Cannot post message after channel has closed ${JSON.stringify(msg)}`);
    }
    return _post(this, "message", msg);
  }

  postInternal(msg: unknown): Promise<unknown> {
    return _post(this, "internal", msg);
  }

  addEventListener(type: EventType, fn: (data: unknown) => void): void {
    const time = this.method.microSeconds();
    const listenObj: ListenerObject = {
      time,
      fn,
    };
    _addListenerObject(this, type, listenObj);
  }

  removeEventListener(type: EventType, fn: (data: unknown) => void): void {
    const obj = this._addEL[type].find((o) => o.fn === fn);
    _removeListenerObject(this, type, obj);
  }

  close(): Promise<void> {
    if (this.closed) {
      return Promise.resolve();
    }
    OPEN_BROADCAST_CHANNELS.delete(this);
    this.closed = true;
    const awaitPrepare = this._prepP ? this._prepP : PROMISE_RESOLVED_VOID;

    this._onML = null;
    this._addEL.message = [];

    return awaitPrepare
      .then(() => Promise.all(Array.from(this._uMP)))
      .then(() => Promise.all(this._befC.map((fn) => fn())))
      .then(() => this.method.close(this._state));
  }
}

function _post(broadcastChannel: BroadcastChannel, type: EventType, msg: unknown): Promise<unknown> {
  const time = broadcastChannel.method.microSeconds();
  const msgObj: MessageObject = {
    time,
    type,
    data: msg,
  };

  const awaitPrepare = broadcastChannel._prepP ? broadcastChannel._prepP : PROMISE_RESOLVED_VOID;
  return awaitPrepare.then(() => {
    const sendPromise = broadcastChannel.method.postMessage(broadcastChannel._state, msgObj);
    broadcastChannel._uMP.add(sendPromise);
    // eslint-disable-next-line promise/catch-or-return, promise/no-nesting
    sendPromise.catch(() => {}).then(() => broadcastChannel._uMP.delete(sendPromise));
    return sendPromise;
  });
}

function _prepareChannel(channel: BroadcastChannel): void {
  const maybePromise = channel.method.create(channel.name, channel.options);
  if (isPromise(maybePromise)) {
    const promise = maybePromise as Promise<unknown>;
    channel._prepP = promise;
    promise
      .then((s) => {
        channel._state = s;
        return s;
      })
      .catch((err) => {
        throw err;
      });
  } else {
    channel._state = maybePromise;
  }
}

function _hasMessageListeners(channel: BroadcastChannel): boolean {
  if (channel._addEL.message.length > 0) return true;
  if (channel._addEL.internal.length > 0) return true;
  return false;
}

function _startListening(channel: BroadcastChannel): void {
  if (!channel._iL && _hasMessageListeners(channel)) {
    const listenerFn = (msgObj: MessageObject) => {
      channel._addEL[msgObj.type].forEach((listenerObject) => {
        if (msgObj.time >= listenerObject.time) {
          listenerObject.fn(msgObj.data);
        } else if (channel.method.type === "server") {
          listenerObject.fn(msgObj.data);
        }
      });
    };

    const time = channel.method.microSeconds();
    if (channel._prepP) {
      channel._prepP
        .then(() => {
          channel._iL = true;
          channel.method.onMessage(channel._state, listenerFn, time);
          return true;
        })
        .catch((err) => {
          throw err;
        });
    } else {
      channel._iL = true;
      channel.method.onMessage(channel._state, listenerFn, time);
    }
  }
}

function _stopListening(channel: BroadcastChannel): void {
  if (channel._iL && !_hasMessageListeners(channel)) {
    channel._iL = false;
    const time = channel.method.microSeconds();
    channel.method.onMessage(channel._state, null, time);
  }
}

function _addListenerObject(channel: BroadcastChannel, type: EventType, obj: ListenerObject): void {
  channel._addEL[type].push(obj);
  _startListening(channel);
}

function _removeListenerObject(channel: BroadcastChannel, type: EventType, obj: ListenerObject | null): void {
  if (obj) {
    channel._addEL[type] = channel._addEL[type].filter((o) => o !== obj);
    _stopListening(channel);
  }
}
