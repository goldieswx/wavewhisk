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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhiskConnectionRepository = exports.WhiskConnection = void 0;
const rxjs_1 = require("rxjs");
const whisk_data_class_js_1 = require("./whisk-data.class.js");
const logger_class_js_1 = require("../helpers/logger.class.js");
const flow_types_js_1 = require("../types/flow.types.js");
const token_generator_class_1 = require("../helpers/token-generator.class");
const whisk_serializer_class_1 = require("./whisk-serializer.class");
/**
 * Manages a connection to a whisk service and its health status.
 */
class WhiskConnection {
    constructor(addressableUri, registeredClasses = []) {
        this.addressableUri = addressableUri;
        this.registeredClasses = registeredClasses;
        this.lastHeartBeat = null;
        this.dataAdapter = new whisk_data_class_js_1.WhiskZMQDataAdapter(this.addressableUri);
        logger_class_js_1.logger.info(`WhiskerConnection created for ${addressableUri}`);
    }
    /**
     * Destroys the connection and its data adapter.
     */
    destroy() {
        logger_class_js_1.logger.info(`WhiskerConnection destroyed for ${this.addressableUri}`);
        this.dataAdapter.destroy();
    }
    getLastHeartbeatDelay() {
        if (this.lastHeartBeat === null) {
            return null;
        }
        return (new Date().getTime() - (this.lastHeartBeat).getTime());
    }
    sendHeartBeat() {
        // [identity, token,  _nodeRef, inputId, header, data ]
        const notUsed = Buffer.alloc(0);
        this.dataAdapter
            .sendAndReceive(token_generator_class_1.tokenGenerator.generateToken(), [notUsed, notUsed, whisk_serializer_class_1.whishSerializer.createShortHeader(flow_types_js_1.HEARTBEAT_EVENT, whisk_serializer_class_1.SERIALZER_MSGPACK)]).then(() => this.lastHeartBeat = new Date());
    }
}
exports.WhiskConnection = WhiskConnection;
/**
 * Manages a collection of WhiskConnection instances.
 */
class WhiskConnectionRepository {
    constructor() {
        this.$_whiskerConnections = new rxjs_1.BehaviorSubject([]);
        this.$whiskerConnections = this.$_whiskerConnections.asObservable();
        this.$_whiskerConnection = new rxjs_1.Subject();
        this.$whiskerConnection = this.$_whiskerConnection.asObservable();
        this.subs = new rxjs_1.Subscription();
        this.subs = this.$_whiskerConnection.subscribe(connection => {
            const allWhisks = this.$_whiskerConnections.value || [];
            if (!allWhisks.find(whickConnection => whickConnection.addressableUri === connection.addressableUri)) {
                logger_class_js_1.logger.info(`WhiskerConnection registered for ${connection.addressableUri}`);
                allWhisks.push(connection);
                this.$_whiskerConnections.next(allWhisks);
            }
        });
        setInterval(() => this.sendHeartBeatEvent(), 2000);
    }
    sendHeartBeatEvent() {
        const allConnections = this.$_whiskerConnections.value;
        allConnections.forEach((connection) => {
            const lastHeartbeatDelay = connection.getLastHeartbeatDelay();
            if ((lastHeartbeatDelay !== null) && (lastHeartbeatDelay >= flow_types_js_1.HEARTBEAT_MAX_DELAY_MS)) {
                logger_class_js_1.logger.error(`HeartBeat overflow. ${connection.addressableUri}`);
            }
            connection.sendHeartBeat();
        });
    }
    /**
     * Finds matching Whisk connections based on a node circuit structure.
     * @param nodeCircuit
     */
    findMatchingWhiskConnections(nodeCircuit) {
        const allWhisks = this.$_whiskerConnections.value;
        if (!allWhisks)
            throw new Error("No whisk connections found");
        // Find matching connections based on node names
        const matches = {};
        for (const node of nodeCircuit.nodes) {
            if (node.flowElement && node.flowElement.name) {
                const match = allWhisks.find(whisk => whisk.registeredClasses.includes(node.flowElement.id));
                if (match)
                    matches[node.id] = match;
            }
        }
        // If not all matches are found, throw an error
        if (Object.keys(matches).length !== nodeCircuit.nodes.length) {
            throw new Error("Not all nodes have matching whisk connections");
        }
        return matches;
    }
    registerWhisk(connection) {
        this.$_whiskerConnection.next(connection);
    }
    onDestroy() {
        logger_class_js_1.logger.info(`WhiskRepository destroyed`);
        this.subs.unsubscribe();
    }
}
exports.WhiskConnectionRepository = WhiskConnectionRepository;
