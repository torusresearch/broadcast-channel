import { MessageObject } from "../types";
import { microSeconds as micro, PROMISE_RESOLVED_VOID } from "../util";

export const microSeconds = micro;

export const type = "native";

interface ChannelState {
  time: number;
  messagesCallback: ((data: MessageObject) => void) | null;
  bc: BroadcastChannel;
  subFns: Array<() => void>;
}

export function create(channelName: string): ChannelState {
  const state: ChannelState = {
    time: micro(),
    messagesCallback: null,
    bc: new BroadcastChannel(channelName),
    subFns: [], // subscriberFunctions
  };

  state.bc.onmessage = (msg) => {
    if (state.messagesCallback) {
      state.messagesCallback(msg.data);
    }
  };

  return state;
}

export function close(channelState: ChannelState): void {
  channelState.bc.close();
  channelState.subFns = [];
}

export function postMessage(channelState: ChannelState, messageJson: MessageObject): Promise<void> {
  try {
    channelState.bc.postMessage(messageJson);
    return PROMISE_RESOLVED_VOID;
  } catch (err) {
    return Promise.reject(err);
  }
}

export function onMessage(channelState: ChannelState, fn: (data: MessageObject) => void): void {
  channelState.messagesCallback = fn;
}

export function canBeUsed(): boolean {
  /**
   * in the electron-renderer, isNode will be true even if we are in browser-context
   * so we also check if window is undefined
   */
  if (typeof window === "undefined") return false;

  if (typeof BroadcastChannel === "function") {
    if ((BroadcastChannel as unknown as { _pubkey: unknown })._pubkey) {
      throw new Error("BroadcastChannel: Do not overwrite window.BroadcastChannel with this module, this is not a polyfill");
    }
    return true;
  }
  return false;
}

export function averageResponseTime(): number {
  return 150;
}
