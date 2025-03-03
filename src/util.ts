// import Bowser from 'bowser';
import loglevel from "loglevel";
/**
 * returns true if the given object is a promise
 */
export function isPromise(obj: unknown): boolean {
  if (obj && typeof (obj as { then: unknown }).then === "function") {
    return true;
  }

  return false;
}

export const PROMISE_RESOLVED_FALSE = Promise.resolve(false);
export const PROMISE_RESOLVED_TRUE = Promise.resolve(true);
export const PROMISE_RESOLVED_VOID = Promise.resolve();

export function sleep<T>(time?: number, resolveWith?: T): Promise<T> {
  if (!time) time = 0;
  return new Promise((resolve) => {
    setTimeout(() => resolve(resolveWith), time);
  });
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * https://stackoverflow.com/a/8084248
 */
export function randomToken(): string {
  return crypto.getRandomValues(new Uint8Array(16)).toString();
}

let lastMs = 0;

/**
 * returns the current time in micro-seconds,
 * WARNING: This is a pseudo-function
 * Performance.now is not reliable in webworkers, so we just make sure to never return the same time.
 * This is enough in browsers, and this function will not be used in nodejs.
 * The main reason for this hack is to ensure that BroadcastChannel behaves equal to production when it is used in fast-running unit tests.
 */
export function microSeconds(): number {
  let ret = Date.now() * 1000; // milliseconds to microseconds
  if (ret <= lastMs) {
    ret = lastMs + 1;
  }
  lastMs = ret;
  return ret;
}

// the problem is only in iframes. we should default to server in case of iframes.
// storage scoping is present in all browsers now
// Safari and other browsers support native Broadcast channel now. It's in LS.
// test here: https://pubkey.github.io/broadcast-channel/e2e.html?methodType=native
// https://caniuse.com/broadcastchannel
// export function are3PCSupported() {
//     if (typeof navigator === 'undefined') return false;
//     const browserInfo = Bowser.parse(navigator.userAgent);
//     log.info(JSON.stringify(browserInfo), 'current browser info');

//     let thirdPartyCookieSupport = true;
//     // brave
//     if (navigator.brave) {
//         thirdPartyCookieSupport = false;
//     }
//     // All webkit & gecko engine instances use itp (intelligent tracking prevention -
//     // https://webkit.org/tracking-prevention/#intelligent-tracking-prevention-itp)
//     if (browserInfo.engine.name === Bowser.ENGINE_MAP.WebKit || browserInfo.engine.name === Bowser.ENGINE_MAP.Gecko) {
//         thirdPartyCookieSupport = false;
//     }

//     return thirdPartyCookieSupport;
// }

export const log = loglevel.getLogger("broadcast-channel");

log.setLevel("error");

export const setLogLevel = (level: loglevel.LogLevelDesc): void => {
  log.setLevel(level);
};
