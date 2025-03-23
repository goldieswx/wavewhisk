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
import {CAN_SEND_NEXT, CURRENT_EVENT,OutletConduit} from "../types/flow.types";
import {WhiskConnectedNode} from "./whisk-connected-node.class";


export class WhiskConduit {

    private terminateConnection: boolean = false;

    constructor( private flowConnection: OutletConduit
                 ,private whiskConnectedNodes: {[nodeId: string]: WhiskConnectedNode}) {

    }

    /**
     * Processes connections within the flow by sending messages and logging responses.
     */
    async processConnections() {

        const fromConnection = this.whiskConnectedNodes[this.flowConnection.from];
        const toConnection = this.whiskConnectedNodes[this.flowConnection.to];

        while (!this.terminateConnection) {


            try {

                await fromConnection.
                /* // Send message on `.from` connection
                const fromConnection = this.whiskConnections[this.flowConnection.from];
                const fromPromise = fromConnection.dataAdapter.sendAndReceive(tokenGenerator.generateToken(), [CAN_SEND_NEXT as any]);

                await this.

                // Send message on `.to` connection
                const toConnection = this.whiskConnections[this.flowConnection.to];
                const toPromise = toConnection.dataAdapter.sendAndReceive(tokenGenerator.generateToken(), [CURRENT_EVENT as any]);

                // Wait for both messages to be processed and received
                const [fromResponse, toResponse] = await Promise.all([fromPromise, toPromise]);

                // Log when both responses are received
                console.log(`Responses received: From connection ${this.flowConnection.id}`);
                console.log(`From response:`, fromResponse);
                console.log(`To response:`, toResponse);*/



           }
           catch  (error) {
            console.error('Error processing connection:', error);
           }
        }

    }

    async onInput(value: Buffer[]) {
        // create an INLET and OUTLET class and the conduit that mixes them together.
    }

    /**
     * Terminates an ongoing process or connection by setting the appropriate flag.
     * @return {void} This method does not return a value.
     */
     public terminate() {
        this.terminateConnection = true;
     }

}