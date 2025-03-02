/**
 * A localStorage-only method which uses localstorage and its 'storage'-event
 * This does not work inside of webworkers because they have no access to locastorage
 * This is basically implemented to support IE9 or your grandmothers toaster.
 * @link https://caniuse.com/#feat=namevalue-storage
 * @link https://caniuse.com/#feat=indexeddb
 */

import { getPublic, sign } from "@toruslabs/eccrypto";
import { decryptData, encryptData, keccak256 } from "@toruslabs/metadata-helpers";
import { ObliviousSet } from "oblivious-set";
import { io, Socket } from "socket.io-client";

import { fillOptionsWithDefaults } from "../options";
import { MessageObject, Options } from "../types";
import { log, microSeconds as micro, randomToken, sleep } from "../util";

export const microSeconds = micro;

const KEY_PREFIX = "pubkey.broadcastChannel-";
export const type = "server";

let SOCKET_CONN_INSTANCE: Socket | null = null;
// used to decide to reconnect socket e.g. when socket connection is disconnected unexpectedly
const runningChannels = new Set<string>();

interface ChannelState {
  channelName: string;
  uuid: string;
  eMIs: ObliviousSet<string>;
  server: {
    api_url: string;
    socket_url: string;
  };
  time: number;
  timeout?: number;
  messagesCallback?: (data: MessageObject) => void;
  messagesCallbackTime?: number;
}

interface Message {
  token: string;
  time: number;
  data: MessageObject;
  uuid: string;
}

interface MessageBody {
  sameOriginCheck: boolean;
  sameIpCheck: boolean;
  key: string;
  data: string;
  signature: string;
  timeout?: number;
}

export function storageKey(channelName: string): string {
  return KEY_PREFIX + channelName;
}

/**
 * writes the new message to the storage
 * and fires the storage-event so other readers can find it
 */
export function postMessage(channelState: ChannelState, messageJson: MessageObject): Promise<Response> {
  return new Promise((resolve, reject) => {
    sleep()
      .then(async () => {
        const key = storageKey(channelState.channelName);
        const channelEncPrivKey = keccak256(Buffer.from(key, "utf8"));
        const encData = await encryptData(channelEncPrivKey.toString("hex"), {
          token: randomToken(),
          time: Date.now(),
          data: messageJson,
          uuid: channelState.uuid,
        });
        const body: MessageBody = {
          sameOriginCheck: true,
          sameIpCheck: true,
          key: getPublic(channelEncPrivKey).toString("hex"),
          data: encData,
          signature: (await sign(channelEncPrivKey, keccak256(Buffer.from(encData, "utf8")))).toString("hex"),
        };
        if (channelState.timeout) body.timeout = channelState.timeout;
        return fetch(`${channelState.server.api_url}/channel/set`, {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        })
          .then(resolve)
          .catch(reject);
      })
      .catch(reject);
  });
}

export function getSocketInstance(socketUrl: string): Socket {
  if (SOCKET_CONN_INSTANCE) {
    return SOCKET_CONN_INSTANCE;
  }
  const SOCKET_CONN = io(socketUrl, {
    transports: ["websocket", "polling"], // use WebSocket first, if available
    withCredentials: true,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: 10,
  });

  SOCKET_CONN.on("connect_error", (err: Error) => {
    // revert to classic upgrade
    SOCKET_CONN.io.opts.transports = ["polling", "websocket"];
    log.error("connect error", err);
  });
  SOCKET_CONN.on("connect", async () => {
    const { engine } = SOCKET_CONN.io;
    log.debug("initially connected to", engine.transport.name); // in most cases, prints "polling"
    engine.once("upgrade", () => {
      // called when the transport is upgraded (i.e. from HTTP long-polling to WebSocket)
      log.debug("upgraded", engine.transport.name); // in most cases, prints "websocket"
    });
    engine.once("close", (reason: string) => {
      // called when the underlying connection is closed
      log.debug("connection closed", reason);
    });
  });

  SOCKET_CONN.on("error", (err: Error) => {
    log.error("socket errored", err);
    SOCKET_CONN.disconnect();
  });
  SOCKET_CONN_INSTANCE = SOCKET_CONN;
  return SOCKET_CONN;
}

export function setupSocketConnection(socketUrl: string, channelState: ChannelState, fn: (data: Message) => void): Socket {
  const socketConn = getSocketInstance(socketUrl);

  const key = storageKey(channelState.channelName);
  const channelEncPrivKey = keccak256(Buffer.from(key, "utf8"));
  const channelPubKey = getPublic(channelEncPrivKey).toString("hex");
  if (socketConn.connected) {
    socketConn.emit("check_auth_status", channelPubKey, { sameOriginCheck: true, sameIpCheck: true });
  } else {
    socketConn.once("connect", () => {
      log.debug("connected with socket");
      socketConn.emit("check_auth_status", channelPubKey, {
        sameOriginCheck: true,
        sameIpCheck: true,
      });
    });
  }

  const reconnect = () => {
    socketConn.once("connect", async () => {
      if (runningChannels.has(channelState.channelName)) {
        socketConn.emit("check_auth_status", channelPubKey, {
          sameOriginCheck: true,
          sameIpCheck: true,
        });
      }
    });
  };
  const visibilityListener = () => {
    // if channel is closed, then remove the listener.
    if (!socketConn || !runningChannels.has(channelState.channelName)) {
      document.removeEventListener("visibilitychange", visibilityListener);
      return;
    }
    // if not connected, then wait for connection and ping server for latest msg.
    if (!socketConn.connected && document.visibilityState === "visible") {
      reconnect();
    }
  };

  const listener = async (ev: string) => {
    try {
      const decData = await decryptData<Message>(channelEncPrivKey.toString("hex"), ev);
      log.info(decData);
      fn(decData);
    } catch (error) {
      log.error(error);
    }
  };

  socketConn.on("disconnect", () => {
    log.debug("socket disconnected");
    if (runningChannels.has(channelState.channelName)) {
      log.error("socket disconnected unexpectedly, reconnecting socket");
      reconnect();
    }
  });

  socketConn.on(`${channelPubKey}_success`, listener);

  if (typeof document !== "undefined") document.addEventListener("visibilitychange", visibilityListener);

  return socketConn;
}

export function removeStorageEventListener(): void {
  if (SOCKET_CONN_INSTANCE) {
    SOCKET_CONN_INSTANCE.disconnect();
  }
}

export function canBeUsed(): boolean {
  return true;
}

export function create(channelName: string, options: Options): ChannelState {
  options = fillOptionsWithDefaults(options);
  if (!canBeUsed()) {
    throw new Error("BroadcastChannel: server cannot be used");
  }

  const uuid = randomToken();

  /**
   * eMIs
   * contains all messages that have been emitted before
   * @type {ObliviousSet}
   */
  const eMIs = new ObliviousSet<string>(options.server.removeTimeout);

  const state: ChannelState = {
    channelName,
    uuid,
    eMIs, // emittedMessagesIds
    server: {
      api_url: options.server.api_url,
      socket_url: options.server.socket_url,
    },
    time: micro(),
  };
  if (options.server.timeout) state.timeout = options.server.timeout;

  setupSocketConnection(options.server.socket_url, state, (msgObj: Message) => {
    if (!state.messagesCallback) return; // no listener
    if (msgObj.uuid === state.uuid) return; // own message
    if (!msgObj.token || state.eMIs.has(msgObj.token)) return; // already emitted
    // if (msgObj.data.time && msgObj.data.time < state.messagesCallbackTime) return; // too old

    state.eMIs.add(msgObj.token);
    state.messagesCallback(msgObj.data);
  });
  runningChannels.add(channelName);

  return state;
}

export function close(channelState: ChannelState): void {
  runningChannels.delete(channelState.channelName);
  // give 2 sec for all msgs which are in transit to be consumed
  // by receiver.
  // window.setTimeout(() => {
  //     removeStorageEventListener(channelState);
  //     SOCKET_CONN_INSTANCE = null;
  // }, 1000);
}

export function onMessage(channelState: ChannelState, fn: (data: MessageObject) => void, time?: number): void {
  channelState.messagesCallbackTime = time;
  channelState.messagesCallback = fn;
}

export function averageResponseTime(): number {
  const defaultTime = 500;
  // TODO: Maybe increase it based on operation
  return defaultTime;
}
