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
import {WhiskConnection} from "../../src/flow-runcore/whisk-repository.class";

export class WhiskConduit {


    constructor( private flowConnection: WhiskNodeCircuit
                ,private whiskConnections: {[nodeId: string]: WhiskConnection}>
    ) {
    }

    /**
     * Processes connections within the flow by sending messages and logging responses.
     */
    async processConnections() {
        for (const connection of this.flowConnection.connections) {
            const fromToken = tokenGenerator.generateToken();
            const toToken = tokenGenerator.generateToken();

            try {
                // Send message on `.from` connection
                const fromPromise = this.sendMessage(connection.from, 'CAN_SEND_NEXT', []);

                // Send message on `.to` connection
                const toPromise = this.sendMessage(connection.to, 'CURRENT_INPUT', []);

                // Wait for both messages to be processed and received
                const [fromResponse, toResponse] = await Promise.all([fromPromise, toPromise]);

                // Log when both responses are received
                console.log(`Responses received: From - ${fromToken}, To - ${toToken}`);
                console.log(`From response:`, fromResponse);
                console.log(`To response:`, toResponse);

            } catch (error) {
                console.error('Error processing connection:', error);
            }
        }
    }

}