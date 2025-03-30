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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhiskConnectionRepository = void 0;
const rxjs_1 = require("rxjs");
const logger_class_js_1 = require("../helpers/logger.class.js");
const node_timers_1 = require("node:timers");
const lodash_1 = __importDefault(require("lodash"));
const { pull } = lodash_1.default;
/**
 * Manages a collection of WhiskConnection instances.
 */
class WhiskConnectionRepository {
    constructor() {
        this.$_whiskConnections = new rxjs_1.BehaviorSubject([]);
        this.$whiskConnections = this.$_whiskConnections.asObservable();
        this.subs = new rxjs_1.Subscription();
    }
    deleteConnection(connection) {
        connection.destroy();
        const allWhisks = this.$_whiskConnections.value;
        if (allWhisks) {
            pull(allWhisks, connection);
        }
        this.$_whiskConnections.next(allWhisks);
    }
    /**
     * Finds matching Whisk connections based on a node circuit structure.
     * @param nodeCircuit
     */
    findMatchingWhiskConnections(nodeCircuit) {
        const allWhisks = this.$_whiskConnections.value;
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
        const allWhisks = this.$_whiskConnections.value || [];
        if (!allWhisks.find(whiskConnection => whiskConnection.addressableUri === connection.addressableUri)) {
            logger_class_js_1.logger.info(`WhiskConnection registered for ${connection.addressableUri}`);
            allWhisks.push(connection);
            this.$_whiskConnections.next(allWhisks);
        }
    }
    onDestroy() {
        logger_class_js_1.logger.info(`WhiskRepository destroyed`);
        this.timer && (0, node_timers_1.clearInterval)(this.timer);
        this.subs.unsubscribe();
    }
}
exports.WhiskConnectionRepository = WhiskConnectionRepository;
