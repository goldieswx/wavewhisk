"use strict";
/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * (C) 2025 David Jakubowski - levelonelab.com
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhiskZMQDataAdapter = void 0;
var async = require("async");
const { queue } = async;
const zeromq_1 = require("zeromq");
const logger_class_js_1 = require("../helpers/logger.class.js");
/**
 * WhiskerZMQDataAdapter class is responsible for managing ZeroMQ communication
 * by handling requests and responses through tokens. It manages pending requests
 * in a dictionary and provides methods to send messages and handle replies.
 */
class WhiskZMQDataAdapter {
    constructor(addressableUri) {
        this.addressableUri = addressableUri;
        this.sendQueue = null;
        this.pendingRequests = {};
        this.mainLoop().then(() => { }); // Start the main loop and ignore its promise result
    }
    /**
     * The main loop continuously listens for messages using the Dealer socket,
     * resolving or rejecting promises based on the received tokens.
     */
    mainLoop() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            this.receiver = new zeromq_1.Dealer({ routingId: "whisk-data-adapter", connectTimeout: 10000 });
            this.sendQueue = queue((msg, done) => __awaiter(this, void 0, void 0, function* () {
                yield this.receiver.send(msg);
                done();
            }), 1);
            yield this.receiver.connect(this.addressableUri);
            try {
                for (var _d = true, _e = __asyncValues(this.receiver), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const msg = _c;
                    const token = msg[0].toString(); // Convert the token to string
                    if (this.pendingRequests[token]) {
                        this.pendingRequests[token].resolve(msg.slice(1)); // Resolve the corresponding promise with the message
                        delete this.pendingRequests[token]; // Remove the request from pending list
                    }
                    else {
                        logger_class_js_1.logger.warn(`Received message with unknown token: ${token}`); // Log a warning for unknown tokens
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
        });
    }
    /**
     * Sends a message and returns a promise that will be resolved when a response is received.
     * @param token - Unique identifier for the request.
     * @param msg - The message to send.
     * @param abortSignal - Promise to abort signal
     * @returns A promise that resolves with the received message or rejects if there's an error.
     */
    sendAndReceive(token, msg, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const sendPromise = new Promise((resolve, reject) => {
                this.pendingRequests[token.toString()] = { resolve, reject }; // Store the resolve and reject functions for the token
                // queue push, can push array of objects, there fore we double the array
                this.sendQueue.push([[token, ...msg]]); // Send the message with the token
            });
            if (abortSignal) {
                // abortSignal can only reject.
                return Promise.race([abortSignal, sendPromise]);
            }
            else {
                return sendPromise;
            }
        });
    }
    /**
     * Closes the ZeroMQ connection and rejects all pending promises to free resources.
     */
    destroy() {
        if (this.receiver) {
            this.receiver.close();
            this.receiver = null;
        }
        // Reject all pending requests to avoid memory leaks
        Object.keys(this.pendingRequests).forEach(token => {
            this.pendingRequests[token].reject(new Error("Connection closed"));
        });
        this.pendingRequests = {};
    }
    /**
     * Rejects the promise associated with a given token, indicating that the request is cancelled.
     * @param token - The unique identifier for the pending request to be rejected.
     * This is used for cancelling tokens.
     */
    rejectToken(token) {
        if (this.pendingRequests[token]) {
            this.pendingRequests[token].reject(new Error("Request cancelled"));
            delete this.pendingRequests[token]; // Remove the request from pending list
        }
        else {
            console.warn(`No pending request with token ${token}`); // Log a warning if no such token exists
        }
    }
}
exports.WhiskZMQDataAdapter = WhiskZMQDataAdapter;
