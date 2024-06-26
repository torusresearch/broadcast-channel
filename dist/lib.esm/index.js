import * as native from './methods/native.js';
export { native as NativeMethod };
import * as indexedDb from './methods/indexed-db.js';
export { indexedDb as IndexedDbMethod };
import * as localstorage from './methods/localstorage.js';
export { localstorage as LocalstorageMethod };
import * as server from './methods/server.js';
export { server as ServerMethod };
export { BroadcastChannel, OPEN_BROADCAST_CHANNELS, enforceOptions } from './broadcast-channel.js';
export { chooseMethod } from './method-chooser.js';
