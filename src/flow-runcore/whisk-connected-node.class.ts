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


// identity token, noderef, pinId, header, data

export interface PinAttachment {
  callBackArray: ((msg: Buffer[]) => Promise<void>)[]
}

/**
 * Represents a node connected to a whisk service with specific communication capabilities.
 */
export class WhiskConnectedNode {

    private outputPinAttachments : { [pinId: string]: PinAttachment } = {};

    private connected = true;
    private allConnectedResolve : any = null;
    private nodeRef = Buffer.from('noderef-of-' + this.node.id);
    private allConnected = new Promise((res) => this.allConnectedResolve = res);

    constructor(
        private whiskConnection: WhiskConnection,
        private node: WhiskNode
    ) {}

    public setAllConnected() {
        this.allConnectedResolve();
    }

    public async initialize() {

        try {
            // Send a request through the data adapter of the connection using its options or configurations
            const initStruct: WhiskNodeCircuitInitialization = {
                options:  this.node.flowElement.options,
                flowElement: { repositoryElementId: this.node.flowElement.id },
                extraInfo: { jobId: 'no-job-defined-yet', nodeId: this.node.id }
            }

            const header = whishSerializer.createShortHeader(SERIALZER_MSGPACK, INIT_FLOW_ELEMENT);


            const response =
                this.whiskConnection.dataAdapter
                    .sendAndReceive( tokenGenerator.generateToken(), [this.nodeRef, header, whishSerializer.packNum(SERIALZER_MSGPACK, initStruct)])
                    .then(() => {
                        logger.info(`[${this.node.id}] Received response from  ${ this.whiskConnection.addressableUri}:`, response);
                    });

            return response;
        } catch (error) {
            logger.error(`[${this.node.id}] Error with connection to ${ this.whiskConnection.addressableUri}:`, error);
        }

    }

    public onOutputPin(from: string, onOutputReady: (msg: Buffer[]) => Promise<void>) {

        const startLoop = !!this.outputPinAttachments[from]
        const pinAttach = this.outputPinAttachments[from] = this.outputPinAttachments[from] || { callBackArray: [] };

        pinAttach.callBackArray.push(onOutputReady);

        if (startLoop) { return pinAttach; }

        // start the async loop the first time.
        (async () => {
            await this.allConnected;
            logger.info(`[${this.node.id}] / output pin ${from} opened.`);
            while(this.connected) {
                const header = whishSerializer.createShortHeader(SERIALZER_MSGPACK, CAN_SEND_NEXT);

                const pinId = Buffer.from(from);
                // send an output ready & upon receive, signal all the output pin attachements that we are ready so thay
                // can do their async business.
                await this.whiskConnection.dataAdapter.sendAndReceive(tokenGenerator.generateToken(),[this.nodeRef,pinId,header]).then(
                    (msg) => {
                        const outputAcks = this.outputPinAttachments[from].callBackArray.map(fn => {
                            fn(msg)
                        })
                        return Promise.all(outputAcks);
                    },
                    (err) => {
                        logger.error(`[${this.node.id}] Error with output pin routing ${from} @ ${ this.whiskConnection.addressableUri}:`, err);
                        throw new Error(err);
                    }
                )
            }
            logger.info(`[${this.node.id}] / output pin ${from} closed.`);
        })();

        return pinAttach;

    }

    public async pushToInputPin(to: string, msg: Buffer[]) {

             /* Incoming msg should be token/header/data */
             console.log('input pin received', msg);
             const header = whishSerializer.createShortHeader(SERIALZER_MSGPACK, CURRENT_EVENT);
             const pinId = Buffer.from(to);
             // guyessing msg-2 is the data. needs to check.
             return this.whiskConnection.dataAdapter.sendAndReceive(tokenGenerator.generateToken(),[this.nodeRef, pinId, header,msg[2]]);

    }
}

