import { MessageObject } from "../types";
import { microSeconds as micro } from "../util";

export const microSeconds = micro;

export const type = "simulate";

interface ChannelState {
  time: number;
  name: string;
  messagesCallback: ((data: MessageObject) => void) | null;
}

const SIMULATE_CHANNELS = new Set<ChannelState>();
export const SIMULATE_DELAY_TIME = 5;

export function create(channelName: string): ChannelState {
  const state: ChannelState = {
    time: micro(),
    name: channelName,
    messagesCallback: null,
  };
  SIMULATE_CHANNELS.add(state);

  return state;
}

export function close(channelState: ChannelState): void {
  SIMULATE_CHANNELS.delete(channelState);
}

export function postMessage(channelState: ChannelState, messageJson: MessageObject): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const channelArray = Array.from(SIMULATE_CHANNELS);
      channelArray.forEach((channel) => {
        if (
          channel.name === channelState.name && // has same name
          channel !== channelState && // not own channel
          !!channel.messagesCallback && // has subscribers
          channel.time < messageJson.time // channel not created after postMessage() call
        ) {
          channel.messagesCallback(messageJson);
        }
      });
      resolve();
    }, SIMULATE_DELAY_TIME);
  });
}

export function onMessage(channelState: ChannelState, fn: (data: MessageObject) => void): void {
  channelState.messagesCallback = fn;
}

export function canBeUsed(): boolean {
  return true;
}

export function averageResponseTime(): number {
  return SIMULATE_DELAY_TIME;
}
