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

import {QueueObject} from "async";

var async = require("async");
const { queue } = async;
import { Dealer } from "zeromq";
import { logger } from "../helpers/logger.class.js";

/**
 * WhiskerZMQDataAdapter class is responsible for managing ZeroMQ communication
 * by handling requests and responses through tokens. It manages pending requests
 * in a dictionary and provides methods to send messages and handle replies.
 */
export class WhiskZMQDataAdapter {

    private receiver: Dealer; // ZeroMQ Dealer socket for receiving messages
    private pendingRequests: { [token: string]: { resolve: (msg: Buffer[]) => void, reject: (err: Error) => void } }; // Dictionary to track pending requests with their tokens

    private sendQueue : QueueObject<Buffer[]> = null

    constructor(private addressableUri: string) {
        this.pendingRequests = {};
        this.mainLoop().then(() => {}); // Start the main loop and ignore its promise result
    }

    /**
     * The main loop continuously listens for messages using the Dealer socket,
     * resolving or rejecting promises based on the received tokens.
     */
    private async mainLoop() {
        this.receiver = new Dealer();
        this.sendQueue = queue(async (msg: Buffer[]) => await this.receiver.send(msg), 1);
        await this.receiver.connect(this.addressableUri);
        for await (const msg of this.receiver) {
            const token = msg[0].toString(); // Convert the token to string
            if (this.pendingRequests[token]) {
                this.pendingRequests[token].resolve(msg.slice(1)); // Resolve the corresponding promise with the message
                delete this.pendingRequests[token]; // Remove the request from pending list
            } else {
                logger.warn(`Received message with unknown token: ${token}`); // Log a warning for unknown tokens
            }
        }
    }

    /**
     * Sends a message and returns a promise that will be resolved when a response is received.
     * @param token - Unique identifier for the request.
     * @param msg - The message to send.
     * @returns A promise that resolves with the received message or rejects if there's an error.
     */
    public async sendAndReceive(token: Buffer, msg: Buffer[]): Promise<Buffer[]> {
        return new Promise((resolve, reject) => {
            this.pendingRequests[token.toString()] = { resolve, reject }; // Store the resolve and reject functions for the token
            this.sendQueue.push([token, ... msg]); // Send the message with the token
        });
    }

    /**
     * Closes the ZeroMQ connection and rejects all pending promises to free resources.
     */
    public destroy() {
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
    public rejectToken(token: string) {
        if (this.pendingRequests[token]) {
            this.pendingRequests[token].reject(new Error("Request cancelled"));
            delete this.pendingRequests[token]; // Remove the request from pending list
        } else {
            console.warn(`No pending request with token ${token}`); // Log a warning if no such token exists
        }
    }
}