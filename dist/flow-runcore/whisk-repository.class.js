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
/**
 * Manages a connection to a whisk service and its health status.
 */
class WhiskConnection {
    constructor(addressableUri, registeredClasses = []) {
        this.addressableUri = addressableUri;
        this.registeredClasses = registeredClasses;
        this.health = null;
        this.lastUpdate = null;
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
            const allWhiskers = this.$_whiskerConnections.value || [];
            if (!allWhiskers.find(whisk => whisk.addressableUri === connection.addressableUri)) {
                logger_class_js_1.logger.info(`WhiskerConnection registered for ${connection.addressableUri}`);
                allWhiskers.push(connection);
                this.$_whiskerConnections.next(allWhiskers);
            }
        });
    }
    /**
     * Finds matching Whisk connections based on a node circuit structure.
     * @param nodeCircuit
     */
    findMatchingWhiskConnections(nodeCircuit) {
        const allWhiskers = this.$_whiskerConnections.value;
        if (!allWhiskers)
            throw new Error("No whisk connections found");
        // Find matching connections based on node names
        const matches = {};
        for (const node of nodeCircuit.nodes) {
            if (node.flowElement && node.flowElement.name) {
                const match = allWhiskers.find(whisk => whisk.registeredClasses.includes(node.flowElement.id));
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
