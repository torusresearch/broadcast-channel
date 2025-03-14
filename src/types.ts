export type MethodType = "idb" | "native" | "localstorage" | "simulate" | "server";

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
  type: MethodType;
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
  api_url?: string;
  socket_url?: string;
  removeTimeout?: number;
  timeout?: number;
  allowed_origin?: string;
}

export interface Options {
  type?: MethodType;
  methods?: Method;
  prepareDelay?: number;
  webWorkerSupport?: boolean;
  idb?: IdbOptions;
  localstorage?: LocalStorageOptions;
  server?: ServerOptions;
}

export interface IBroadcastChannel<T> {
  name: string;
  options: Options;
  closed: boolean;

  onmessage: ((data: T) => void) | null;

  postMessage(message: T): Promise<T>;
  addEventListener(type: EventType, listener: (data: T) => void): void;
  removeEventListener(type: EventType, listener: (data: T) => void): void;
  close(): Promise<void>;
}
