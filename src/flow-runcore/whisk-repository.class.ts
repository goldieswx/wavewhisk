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
import {WhiskZMQDataAdapter} from "./whisk-data.class.js";
import {logger} from "../helpers/logger.class.js";
import {
    HEARTBEAT_ASKRATE_DELAY_MS,
    HEARTBEAT_EVENT,
    HEARTBEAT_MAX_DELAY_MS,
    WhiskNodeCircuit
} from "../types/flow.types.js";
import {tokenGenerator} from "../helpers/token-generator.class";
import {SERIALZER_MSGPACK, whishSerializer} from "./whisk-serializer.class";


/**
 * Manages a connection to a whisk service and its health status.
 */
export class WhiskConnection {

    lastHeartBeat: Date = null;
    dataAdapter  = new WhiskZMQDataAdapter(this.addressableUri);

    constructor(public readonly addressableUri: string, public registeredClasses: string[] = []) {

          logger.info(`WhiskerConnection created for ${addressableUri}`);

    }
    /**
     * Destroys the connection and its data adapter.
     */
    destroy() {
          logger.info(`WhiskerConnection destroyed for ${this.addressableUri}`);
          this.dataAdapter.destroy();
    }

    getLastHeartbeatDelay(): number {

        if (this.lastHeartBeat === null) {
            return null;
        }
        return (new Date().getTime() - (this.lastHeartBeat).getTime());
    }

    sendHeartBeat() {
        // [identity, token,  _nodeRef, inputId, header, data ]
        const notUsed = Buffer.alloc(0);
        this.dataAdapter
            .sendAndReceive(
                tokenGenerator.generateToken(),
                [notUsed, notUsed, whishSerializer.createShortHeader(HEARTBEAT_EVENT, SERIALZER_MSGPACK)]).then(() => this.lastHeartBeat = new Date()
            );
    }
}


/**
 * Manages a collection of WhiskConnection instances.
 */
export class WhiskConnectionRepository {


    private $_whiskerConnections = new BehaviorSubject<WhiskConnection[]>([]);
    public readonly $whiskerConnections = this.$_whiskerConnections.asObservable();

    private $_whiskerConnection = new Subject<WhiskConnection>();
    public readonly $whiskerConnection = this.$_whiskerConnection.asObservable();

    private subs = new Subscription();

    constructor() {

        this.subs = this.$_whiskerConnection.subscribe(connection => {

            const allWhisks = this.$_whiskerConnections.value || [];
            if (!allWhisks.find(whickConnection => whickConnection.addressableUri === connection.addressableUri)) {
                logger.info(`WhiskerConnection registered for ${connection.addressableUri}`);
                allWhisks.push(connection);
                this.$_whiskerConnections.next(allWhisks);
            }

        });

        // TODO: clear thuie interval
        setInterval(() => this.sendHeartBeatEvent(), HEARTBEAT_ASKRATE_DELAY_MS);
    }

    private sendHeartBeatEvent() {

        const allConnections = this.$_whiskerConnections.value;


        allConnections.forEach((connection: WhiskConnection) => {

            const lastHeartbeatDelay = connection.getLastHeartbeatDelay();
            if  ((lastHeartbeatDelay !== null) && (lastHeartbeatDelay >= HEARTBEAT_MAX_DELAY_MS)) {
                logger.error(`HeartBeat overflow. ${connection.addressableUri}`);
            }
            connection.sendHeartBeat();
        })

    }

    /**
     * Finds matching Whisk connections based on a node circuit structure.
     * @param nodeCircuit
     */
    public findMatchingWhiskConnections(nodeCircuit: WhiskNodeCircuit): {[nodeId: string]: WhiskConnection} {

        const allWhisks = this.$_whiskerConnections.value;
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
            this.$_whiskerConnection.next(connection);
    }

    public onDestroy() {
        logger.info(`WhiskRepository destroyed`);
        this.subs.unsubscribe();
    }

}