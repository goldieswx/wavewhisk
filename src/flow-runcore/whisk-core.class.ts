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


import {INIT_TIMEOUT_DELAY, WhiskNodeCircuit} from "../types/flow.types.js";
import {WhiskConnection, WhiskConnectionRepository} from "./whisk-repository.class.js";
import {logger} from "../helpers/logger.class.js";
import {WhiskConnectedNode} from "./whisk-connected-node.class";
import lodash from "lodash";
import {WhiskConduit} from "./whisk-conduit.class";
const { forOwn } = lodash;


export class WhiskCore {


     private connectedNodes: {[nodeId: string]: WhiskConnectedNode } = {};
     private conduits : WhiskConduit[] = [];

     constructor(private connections:  WhiskConnectionRepository ) {
     }

     async build(flow: WhiskNodeCircuit) {

         const matchingConnections =  this.connections.findMatchingWhiskConnections(flow);
         logger.info(matchingConnections);

         /* Node initialization*/
         const initializeNodes = Promise.all(this.buildFlowInitialize(matchingConnections, flow));

         const timeout = new Promise((resolve, reject) => {
             setTimeout(() => { reject(new Error('Operation timed out after 15 seconds')); }, INIT_TIMEOUT_DELAY);
         });

         try {
             // Await all responses and log them once everything is processed
             const timedResults = await Promise.race([initializeNodes, timeout]);
             logger.info('All connections have responded:', timedResults);
         } catch (error) {
             logger.error('Operation timed out or encountered an error:', error);
             throw new Error('Timed out waiting for connections to initialize.');
         }

         /* Node conduit connection */
         flow.connections.forEach(connection => {
                  const conduit = new WhiskConduit(connection, this.connectedNodes);
                  // push connections asyncronously.
                  conduit.attachConduit();
                  this.conduits.push(conduit);
         })

         forOwn(this.connectedNodes, (node) => {
             node.setAllConnected();
         })


     }

    /**
     * Initializes the flow by sending requests through matching connections.
     *
     * This method iterates over a collection of matching connections, sends initialization data
     * to each connection's data adapter using its options or configurations, and collects the responses as promises.
     * It logs information about successful responses and errors encountered during the process.
     *
     * @param {Object} matchingConnections A dictionary where keys are node IDs (strings) and values are WhiskConnection objects,
     *                                     representing the connections associated with those nodes.
     * @param {WhiskNodeCircuit} flow Represents a flow circuit containing nodes. Each node has an ID and a corresponding flow element.
     * @return {Array} An array of promises, each containing the URI of the connection and its response data.
     */
     buildFlowInitialize(matchingConnections:  { [p: string]: WhiskConnection }, flow: WhiskNodeCircuit): Array<any> {
         // Prepare an array of promises to await all responses from connections
         const responsePromises : Promise<any>[] = [];

         // Use dictionary comprehension to iterate over the matching connections

        forOwn(matchingConnections,(connection, nodeId) => {
             const node = flow.nodes.find(node => node.id === nodeId);

             if (!node) { throw new Error(`Node with ID ${nodeId} not found in matching connections.`); }
             const connectedNode = this.connectedNodes[nodeId] = new WhiskConnectedNode(connection, node);
             responsePromises.push(connectedNode.initialize());
         })

         return responsePromises;
     }

}

// usage example
const connRepo = new WhiskConnectionRepository();

connRepo.registerWhisk(new WhiskConnection('tcp://worker-1:5050', ['industream/random-data-adaoter/1.0.1']));
connRepo.registerWhisk(new WhiskConnection('tcp://worker-2:5060', ['industream/debug-data-sink/1.0.1']));

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
            displayName: "Default Outlet"}]
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
                displayName: "Default Outlet"}]
        }],
    connections: [{ from: "node/1-default", to: "node/2-default", id:"-"}]
});





