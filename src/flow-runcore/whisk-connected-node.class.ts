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


import {WhiskConnection} from "./whisk-repository.class";
import {tokenGenerator} from "../helpers/token-generator.class";
import {
    CAN_SEND_NEXT,
    CURRENT_EVENT,
    INIT_FLOW_ELEMENT,
    WhiskNode,
    WhiskNodeCircuitInitialization
} from "../types/flow.types";
import {logger} from "../helpers/logger.class";
import {SERIALZER_MSGPACK, whishSerializer} from "./whisk-serializer.class";

import * as lodash from 'lodash';
const { pull } = lodash;

// identity token, noderef, pinId, header, data

export type PinAttachmentCallback = (msg: Buffer[]) => Promise<void>;

export interface PinAttachment {
  callBackArray: PinAttachmentCallback[]
}

/**
 * Represents a node connected to a whisk service with specific communication capabilities.
 */
export class WhiskConnectedNode {
    private outputPinAttachments: { [pinId: string]: PinAttachment } = {};
    private connected = true;
    private allConnectedResolve: (() => void) | null = null;
    private nodeRef: Buffer;

    private aborted = false;
    private abortCancelSignalRejecter : any;
    private abortedByCancelSignal : Promise<void>;



    constructor(
        private whiskConnection: WhiskConnection,
        private node: WhiskNode
    ) {
        // Initialize the node reference with a unique identifier
        this.nodeRef = Buffer.from('noderef-of-' + this.node.id);

        this.abortedByCancelSignal=  new Promise(
            (resolve, reject) => this.abortCancelSignalRejecter = () => {
                this.onAbortedByCancelSignal();
                reject();
            });

    }

    public getOnAborted() : Promise<true> {
        return this.abortedByCancelSignal.catch(() => true) as Promise<true>;
    }

    public disconnect() {
        this.connected = false;
    }

    /**
     * Marks all connections as established.
     */
    public setAllConnected() {
        if (this.allConnectedResolve) {
            this.allConnectedResolve();
        }
    }

    public abort() {
        if (this.aborted) {
            return;
        };
        logger.warn(`aborting ${this.node.id}`);
        this.abortCancelSignalRejecter();
    }
    /**
     * Initializes the node by sending a configuration structure to the whisk connection.
     */
    public async initialize() {
        try {
            const initStruct: WhiskNodeCircuitInitialization = {
                options: this.node.flowElement.options,
                flowElement: { repositoryElementId: this.node.flowElement.id },
                extraInfo: { jobId: 'no-job-defined-yet', nodeId: this.node.id }
            };

            // Create a header and serialize the initialization structure
            const header = whishSerializer.createShortHeader(INIT_FLOW_ELEMENT, SERIALZER_MSGPACK);
            const serializedInitStruct = whishSerializer.packNum(SERIALZER_MSGPACK, initStruct);

            // Send and receive data through the whisk connection's adapter
            // [identity, token,  _nodeRef, inputId, header, data ]
            const response = await this.whiskConnection.dataAdapter.sendAndReceive(
                tokenGenerator.generateToken(),
                [this.nodeRef, Buffer.alloc(0), header, serializedInitStruct]
            );

            logger.info(`[${this.node.id}] Received response from ${this.whiskConnection.addressableUri}`);
            return response;

        } catch (error) {
            logger.error(`[${this.node.id}] Error with connection to ${this.whiskConnection.addressableUri}:`, error);
        }
    }


    // Promise that resolves when all connections are established
    private allConnected = new Promise<void>((resolve) => {
        this.allConnectedResolve = resolve;
    });

    private handleInputResponse(message: Buffer[]): Buffer[] {

        // [header],[data]
        if (message && message[0]) {
            const header = message[0];
            if (header && header.length >= 4 && header.readUInt32LE() === 0xFFFF) {
                console.error("Worker signalled error");
                throw new Error('Worker Signalled Error');
            }
        }

        return message;
    }


    private onAbortedByCancelSignal() {
        this.aborted = true;
        this.disconnect();
    }


    /**
     *
     * @param message
     * @private
     */
    private handleOutputResponse(message: Buffer[]): Buffer[] {

        // [header],[data]
        if (message && message[0]) {
            const header = message[0];
            if (header && header.length >= 4 && header.readUInt32LE() === 0xFFFF) {
                console.error("Worker signalled error");
                throw new Error('Worker Signalled Error');
            }
        }

        return message;
    }


    private getMemSafeAbortedByCancelSignal() {

        let localAbort: any;
        const abortedByCancelSignal = new Promise<void>((res, rej) =>  {
            localAbort = rej;
            this.abortedByCancelSignal.catch((err) => rej());
        });

        return [localAbort, abortedByCancelSignal];
    }


    public detachPin(pinId: string, callBackFn: PinAttachmentCallback) {

        if (this.outputPinAttachments[pinId]) {
            pull(this.outputPinAttachments[pinId].callBackArray, callBackFn);
        }

    }

    /**
     * Registers a callback for an output pin and starts the async loop if it's the first time.
     */
    public onOutputPin(from: string, onOutputReady: (msg: Buffer[]) => Promise<void>): PinAttachmentCallback {
        const startLoop = !!this.outputPinAttachments[from];
        const pinAttach = this.outputPinAttachments[from] = this.outputPinAttachments[from] || { callBackArray: [] };
        pinAttach.callBackArray.push(onOutputReady);

        if (!startLoop) {
            // Start the async loop for output pins
            (async () => {
                await this.allConnected;
                logger.info(`[${this.node.id}] / output pin ${from} opened.`);

                while (this.connected) {
                    const header = whishSerializer.createShortHeader(CAN_SEND_NEXT, SERIALZER_MSGPACK);
                    const pinId = Buffer.from(from);

                    // Duplicate cancelSignalPromise (avoid race memory leak)
                    let [localAbort, abortedByCancelSignal] = this.getMemSafeAbortedByCancelSignal();

                    try {
                        // Notify the whisk connection that we are ready to send data
                        const response = await this.whiskConnection.dataAdapter.sendAndReceive(
                            tokenGenerator.generateToken(),
                            [this.nodeRef, pinId, header],
                            abortedByCancelSignal
                        );

                        // check if the response is not an error.
                        const message = this.handleOutputResponse(response);

                        // Execute all registered callbacks with the received message (normally all inputs)
                        const inputAcks = this.outputPinAttachments[from].callBackArray.map(fn => fn(message));

                        // await all parallel (normally all inputs).
                        await Promise.all(inputAcks);

                    } catch (err : any) {
                        logger.error(`[${this.node.id}] Error with output pin routing ${from} @ ${this.whiskConnection.addressableUri}:`, err);
                        this.abort();
                        // throw new Error(err?.message || err);
                    } finally {
                        // resolve promise, to close memory leak.
                        localAbort();
                    }
                }

                logger.info(`[${this.node.id}] / output pin ${from} closed.`);
            })();
        }

        return onOutputReady;
    }

    /**
     * Pushes a message to an input pin of the whisk connection.
     */
    public async pushToInputPin(to: string, msg: Buffer[]) {
        const header = whishSerializer.createShortHeader(CURRENT_EVENT, SERIALZER_MSGPACK);
        const pinId = Buffer.from(to);

        // Assuming msg[2] contains the actual data
        const response = await this.whiskConnection.dataAdapter.sendAndReceive(
            tokenGenerator.generateToken(),
            [this.nodeRef, pinId, header, msg[2]]
        );

        this.handleInputResponse(response);

        return response;
    }
}
