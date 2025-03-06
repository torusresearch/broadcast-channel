/* eslint-disable @typescript-eslint/no-explicit-any */
import base64url from "base64url";

import { BroadcastChannel } from "./broadcast-channel";
import { RedundantAdaptiveBroadcastChannel } from "./redundant-adaptive-broadcast-channel";

declare global {
  interface Window {
    broadcastChannelLib: any;
    base64urlLib: any;
  }
}

if (typeof window !== "undefined") {
  window.broadcastChannelLib = {};
  window.broadcastChannelLib.BroadcastChannel = BroadcastChannel;
  window.broadcastChannelLib.RedundantAdaptiveBroadcastChannel = RedundantAdaptiveBroadcastChannel;
  window.base64urlLib = {};
  window.base64urlLib.encode = base64url.encode;
  window.base64urlLib.decode = base64url.decode;
  window.base64urlLib.toBase64 = base64url.toBase64;
  window.base64urlLib.fromBase64 = base64url.fromBase64;
  window.base64urlLib.toBuffer = base64url.toBuffer;
}
