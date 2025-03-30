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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhiskConnectionRepository = exports.WhiskConnection = void 0;
const rxjs_1 = require("rxjs");
const whisk_data_class_js_1 = require("./whisk-data.class.js");
const logger_class_js_1 = require("../helpers/logger.class.js");
const flow_types_js_1 = require("../types/flow.types.js");
const token_generator_class_1 = require("../helpers/token-generator.class");
const whisk_serializer_class_1 = require("./whisk-serializer.class");
const node_timers_1 = require("node:timers");
const lodash_1 = __importDefault(require("lodash"));
const { pull } = lodash_1.default;
/**
 * Manages a connection to a whisk service and its health status.
 */
class WhiskConnection {
    constructor(addressableUri, registeredClasses = [], options) {
        this.addressableUri = addressableUri;
        this.registeredClasses = registeredClasses;
        this.options = options;
        this.lastHeartBeat = null;
        this.dataAdapter = new whisk_data_class_js_1.WhiskZMQDataAdapter(this.addressableUri);
        this.status = 'initializing';
        this.$_status = new rxjs_1.BehaviorSubject(this.status);
        this.$status = this.$_status.asObservable();
        this.onDestroy = new Promise((resolve, reject) => this.destroyResolver = resolve);
        logger_class_js_1.logger.info(`WhiskConnection created for ${addressableUri}`);
        this.$status.subscribe((status) => {
            if (status === 'initializing') {
                logger_class_js_1.logger.info('Initializing...', addressableUri);
                setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.dataAdapter.open();
                        yield this.sendSchedulerInitialize();
                        this.updateStatus('healthy');
                    }
                    catch (e) {
                        logger_class_js_1.logger.warn('Couldn\'t initialize connection', e);
                        this.updateStatus('error');
                    }
                }));
            }
            if (status === 'error') {
                if (this.timer) {
                    (0, node_timers_1.clearInterval)(this.timer);
                    this.timer = null;
                }
                logger_class_js_1.logger.warn(`Connection failed for ${addressableUri}, retrying in 5s`);
                setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                    this.updateStatus('initializing');
                }), 5000);
                this.dataAdapter.close();
            }
            if (status === 'healthy') {
                if (this.timer) {
                    (0, node_timers_1.clearInterval)(this.timer);
                    this.timer = null;
                }
                this.timer = setInterval(() => this.sendHeartBeatEvent(), flow_types_js_1.HEARTBEAT_ASKRATE_DELAY_MS);
            }
        });
    }
    getStatus() {
        return this.$_status.value;
    }
    /**
     * Destroys the connection and its data adapter.
     */
    destroy() {
        if (this.timer) {
            (0, node_timers_1.clearInterval)(this.timer);
        }
        this.destroyResolver();
        logger_class_js_1.logger.info(`WhiskConnection destroyed for ${this.addressableUri}`);
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
            .sendAndReceive(token_generator_class_1.tokenGenerator.generateToken(), [notUsed, notUsed, whisk_serializer_class_1.whishSerializer.createShortHeader(flow_types_js_1.HEARTBEAT_EVENT, whisk_serializer_class_1.SERIALZER_MSGPACK)])
            .then(() => this.lastHeartBeat = new Date())
            .catch(error => logger_class_js_1.logger.error(`WhiskConnection sendHeartBeat`, error));
    }
    sendSchedulerInitialize() {
        return __awaiter(this, void 0, void 0, function* () {
            // [identity, token,  _nodeRef, inputId, header, data ]
            const notUsed = Buffer.alloc(0);
            yield this.dataAdapter.sendAndReceive(token_generator_class_1.tokenGenerator.generateToken(), [notUsed, notUsed, whisk_serializer_class_1.whishSerializer.createShortHeader(flow_types_js_1.SCHEDULER_RESTART, whisk_serializer_class_1.SERIALZER_MSGPACK)]);
            this.lastHeartBeat = new Date();
            //  .catch(error => logger.error(`WhiskConnection send SCHEDULER_RESTART`, error));
        });
    }
    updateStatus(status) {
        this.status = status;
        this.$_status.next(status);
    }
    sendHeartBeatEvent() {
        const lastHeartbeatDelay = this.getLastHeartbeatDelay();
        if ((lastHeartbeatDelay !== null) && (lastHeartbeatDelay >= flow_types_js_1.HEARTBEAT_MAX_DELAY_MS)) {
            logger_class_js_1.logger.error(`HeartBeat overflow. ${this.addressableUri}`);
            this.updateStatus('error');
            return;
        }
        this.sendHeartBeat();
    }
}
exports.WhiskConnection = WhiskConnection;
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
            logger_class_js_1.logger.info(`WhiskerConnection registered for ${connection.addressableUri}`);
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
