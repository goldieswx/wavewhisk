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
exports.WhiskCore = void 0;
const whisk_repository_class_js_1 = require("./whisk-repository.class.js");
const logger_class_js_1 = require("../helpers/logger.class.js");
class WhiskCore {
    constructor(connections) {
        this.connections = connections;
    }
    build(flow) {
        const matchingConnections = this.connections.findMatchingWhiskConnections(flow);
        logger_class_js_1.logger.info(matchingConnections);
    }
}
exports.WhiskCore = WhiskCore;
const connRepo = new whisk_repository_class_js_1.WhiskConnectionRepository();
connRepo.registerWhisk(new whisk_repository_class_js_1.WhiskConnection('tcp://worker-1:5050', ['industream/random-data-adaoter/1.0.1']));
connRepo.registerWhisk(new whisk_repository_class_js_1.WhiskConnection('tcp://worker-2:5060', ['industream/debug-data-sink/1.0.1']));
const core = new WhiskCore(connRepo);
core.build({
    nodes: [{
            flowElement: {
                name: "Random Data Adapter",
                id: 'industream/random-data-adaoter/1.0.1',
                icon: 'question_mark',
                options: { sr: 1 },
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
                id: 'industream/debug-data-sink/1.0.1',
                icon: 'question_mark',
                options: { sk: 1 },
                type: 'sink'
            },
            id: "node/2",
            inputs: [],
            outputs: [{
                    id: "default",
                    displayName: "Default Outlet"
                }]
        }],
    connections: [{ from: "node/1-default", to: "node/2-default", id: "-" }]
});
