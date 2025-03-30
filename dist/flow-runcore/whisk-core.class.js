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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhiskCore = void 0;
const whisk_repository_class_js_1 = require("./whisk-repository.class.js");
const whisk_circuit_class_1 = require("./whisk-circuit.class");
const logger_class_1 = require("../helpers/logger.class");
const whisk_connection_class_1 = require("./whisk-connection.class");
class WhiskCore {
    constructor(connections) {
        this.connections = connections;
        this.circuits = {};
    }
    build(importCircuit, circuitId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!circuitId || !circuitId.length) {
                throw new Error("CircuitId must be a valid string");
            }
            if (this.circuits[circuitId]) {
                throw new Error('CircuitId already exists');
            }
            const circuit = this.circuits[circuitId] = new whisk_circuit_class_1.WhiskCircuit(this.connections);
            circuit.getOnTerminated().then(() => {
                logger_class_1.logger.info(`Circuit: ${circuitId} terminated!`);
                delete this.circuits[circuitId];
            });
            try {
                yield circuit.build(importCircuit, circuitId);
            }
            catch (error) {
                logger_class_1.logger.debug(`Failed to build circuit ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
                delete this.circuits[circuitId];
                throw new Error(error);
            }
            return circuit;
        });
    }
    terminateCircuit(circuitId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.circuits[circuitId]) {
                throw new Error(`CircuitId ${circuitId} does not exist`);
            }
            const circuit = this.circuits[circuitId];
            circuit.abort();
            yield circuit.getOnTerminated();
        });
    }
}
exports.WhiskCore = WhiskCore;
// usage example
const connRepo = new whisk_repository_class_js_1.WhiskConnectionRepository();
connRepo.registerWhisk(new whisk_connection_class_1.WhiskConnection('tcp://localhost:5050', ['industream/random-data-adapter/1.0.1']));
connRepo.registerWhisk(new whisk_connection_class_1.WhiskConnection('tcp://localhost:5060', ['industream/dump-sink/1.0.0']));
const core = new WhiskCore(connRepo);
let circuit;
const buildCore = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const circuit = yield core.build({
            nodes: [{
                    flowElement: {
                        name: "Random Data Adapter",
                        id: 'industream/random-data-adapter/1.0.1',
                        icon: 'question_mark',
                        options: {
                            "dataKey": "field1",
                            "dataIncrement": 1,
                            "pushIntervalMs": 2500,
                            "debug": {
                                "modCheck": 1000
                            }
                        },
                        type: 'source'
                    },
                    id: "node/1",
                    inputs: [],
                    outputs: [{
                            id: "default",
                            displayName: "Default Outlet"
                        }]
                },
                {
                    flowElement: {
                        name: "Random Data Sink",
                        id: 'industream/dump-sink/1.0.0',
                        icon: 'question_mark',
                        options: {
                            pathOutputPrefix: "/tmp/filePrefix-",
                            maxFileSize: "50MiB"
                        },
                        type: 'sink'
                    },
                    id: "node/2",
                    inputs: [{
                            id: "default",
                            displayName: "Default Outlet"
                        }],
                    outputs: []
                }],
            connections: [{ from: "node/1-default", to: "node/2-default", id: "-" }]
        }, 'my-new-circuit');
        circuit.getOnTerminated().then((result) => {
            console.log("flow terminated");
            setTimeout(() => buildCore(), 5000);
        });
    }
    catch (error) {
        console.log('FAIL TO build circuit with error: ', error);
        setTimeout(() => buildCore(), 5000);
    }
});
setTimeout(() => buildCore(), 5000);
