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

import {BehaviorSubject, Subject, Subscription} from "rxjs";

import {logger} from "../helpers/logger.class.js";
import {
    WhiskNodeCircuit
} from "../types/flow.types.js";
import {clearInterval} from "node:timers";
import lodash from "lodash";
import {WhiskConnection} from "./whisk-connection.class";
const { pull } = lodash;


/**
 * Manages a collection of WhiskConnection instances.
 */
export class WhiskConnectionRepository {


    private $_whiskConnections = new BehaviorSubject<WhiskConnection[]>([]);
    public readonly $whiskConnections = this.$_whiskConnections.asObservable();



    private timer : any;
    private subs = new Subscription();

    constructor() {

    }

    public deleteConnection(connection: WhiskConnection) {

            connection.destroy();

            const allWhisks = this.$_whiskConnections.value;
            if (allWhisks) {
                pull(allWhisks,connection);
            }
            this.$_whiskConnections.next(allWhisks);
    }
    
    /**
     * Finds matching Whisk connections based on a node circuit structure.
     * @param nodeCircuit
     */
    public findMatchingWhiskConnections(nodeCircuit: WhiskNodeCircuit): {[nodeId: string]: WhiskConnection} {

        const allWhisks = this.$_whiskConnections.value;
        if (!allWhisks) throw new Error("No whisk connections found");

        // Find matching connections based on node names
        const matches : {[nodeCircuitId: string]: WhiskConnection} = {};
        for (const node of nodeCircuit.nodes) {
            if (node.flowElement && node.flowElement.name) {
                const match = allWhisks.find(whisk => whisk.registeredClasses.includes(node.flowElement.id));
                if (match) matches[node.id] = match;
            }
        }

        // If not all matches are found, throw an error
        if (Object.keys(matches).length !== nodeCircuit.nodes.length) {
            throw new Error("Not all nodes have matching whisk connections");
        }

        return matches;

    }

    public registerWhisk(connection: WhiskConnection) {

        const allWhisks = this.$_whiskConnections.value || [];
        if (!allWhisks.find(whiskConnection => whiskConnection.addressableUri === connection.addressableUri)) {
            logger.info(`WhiskerConnection registered for ${connection.addressableUri}`);
            allWhisks.push(connection);
            this.$_whiskConnections.next(allWhisks);
        }

    }

    public onDestroy() {
        logger.info(`WhiskRepository destroyed`);
        this.timer && clearInterval(this.timer);
        this.subs.unsubscribe();
    }

}