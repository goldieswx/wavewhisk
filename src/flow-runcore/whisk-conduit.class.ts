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
import {PinAttachment, WhiskConnectedNode} from "./whisk-connected-node.class";


export class WhiskConduit {

    private terminateToken: PinAttachment = null;

    constructor( private flowConnection: OutletConduit
                 ,private whiskConnectedNodes: {[nodeId: string]: WhiskConnectedNode}) {
    }

    /**
     * Processes connections within the flow by sending messages and logging responses.
     */
    public attachConduit() {

        const fromConnection = this.whiskConnectedNodes[this.flowConnection.from];
        const toConnection = this.whiskConnectedNodes[this.flowConnection.to];

        this.terminateToken = fromConnection.onOutputPin(this.flowConnection.from, async (msg: Buffer[]) => {
            await toConnection.pushToInputPin(this.flowConnection.to, msg);
        });


    }




}