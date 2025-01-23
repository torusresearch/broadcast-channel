'use strict';

var indexedDb = require('./methods/indexed-db.js');
var localstorage = require('./methods/localstorage.js');
var native = require('./methods/native.js');
var server = require('./methods/server.js');
var broadcastChannel = require('./broadcast-channel.js');
var methodChooser = require('./method-chooser.js');



exports.IndexedDbMethod = indexedDb;
exports.LocalstorageMethod = localstorage;
exports.NativeMethod = native;
exports.ServerMethod = server;
exports.BroadcastChannel = broadcastChannel.BroadcastChannel;
exports.OPEN_BROADCAST_CHANNELS = broadcastChannel.OPEN_BROADCAST_CHANNELS;
exports.enforceOptions = broadcastChannel.enforceOptions;
exports.chooseMethod = methodChooser.chooseMethod;
