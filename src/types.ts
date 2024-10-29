/* eslint-disable no-use-before-define */
export interface ListenerObject {
  time: number;
  fn: (data: unknown) => void;
}

export type AddEventListeners = {
  // addEventListeners
  message: ListenerObject[];
  internal: ListenerObject[];
};

export type EventType = keyof AddEventListeners;

export interface MessageObject {
  time: number;
  type: EventType;
  data: unknown;
}

export interface Method {
  type: string;
  canBeUsed: (options: Options) => boolean;
  microSeconds: () => number;
  create: (name: string, options: Options) => unknown | Promise<unknown>;
  postMessage: (state: unknown, msg: MessageObject) => Promise<unknown>;
  onMessage: (state: unknown, fn: ((msg: MessageObject) => void) | null, time: number) => void;
  close: (state: unknown) => void | Promise<void>;
}

interface IdbOptions {
  ttl?: number;
  fallbackInterval?: number;
  onclose?: () => void;
}

interface LocalStorageOptions {
  removeTimeout?: number;
}

interface ServerOptions {
  url?: string;
  removeTimeout?: number;
  timeout?: number;
}

export interface Options {
  type?: string;
  methods?: Method;
  prepareDelay?: number;
  webWorkerSupport?: boolean;
  idb?: IdbOptions;
  localstorage?: LocalStorageOptions;
  server?: ServerOptions;
}
