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



import { WhiskConnectionRepository} from "./whisk-repository.class.js";
import {WhiskNodeCircuitImport} from "../types/flow.types";
import {WhiskCircuit} from "./whisk-circuit.class";
import {logger} from "../helpers/logger.class";
import {WhiskConnection} from "./whisk-connection.class";


export class WhiskCore {

     private  circuits: {[circuitId: string] : WhiskCircuit } = {};

     constructor(private connections:  WhiskConnectionRepository ) {
     }

     public async build(importCircuit: WhiskNodeCircuitImport, circuitId: string): Promise<WhiskCircuit> {

            if (!circuitId || !circuitId.length) {
                throw new Error("CircuitId must be a valid string");
            }

            if (this.circuits[circuitId]) {
                throw new Error('CircuitId already exists');
            }

            const circuit =   this.circuits[circuitId]  = new WhiskCircuit(this.connections);

             circuit.getOnTerminated().then(() => {
                 logger.info(`Circuit: ${circuitId} terminated!`);
                 delete this.circuits[circuitId];
             })

             try {
                 await circuit.build(importCircuit, circuitId);
             } catch (error: any) {
                 logger.debug(`Failed to build circuit ${error?.message || error}`);
                 delete this.circuits[circuitId];
                 throw new Error(error);
             }

             return circuit;
     }

     public async terminateCircuit(circuitId: string): Promise<void> {

          if (!this.circuits[circuitId]) {
              throw new Error(`CircuitId ${circuitId} does not exist`);
          }

          const circuit = this.circuits[circuitId];

          circuit.abort();
          await circuit.getOnTerminated();
     }

}

// usage example
const connRepo = new WhiskConnectionRepository();

connRepo.registerWhisk(new WhiskConnection('tcp://localhost:5050', ['industream/random-data-adapter/1.0.1']));
connRepo.registerWhisk(new WhiskConnection('tcp://localhost:5060', ['industream/dump-sink/1.0.0']));

const core = new WhiskCore(connRepo);
let circuit: WhiskCircuit;

const buildCore = async () => {
   try {
       const circuit = await core.build({
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
           connections: [{from: "node/1-default", to: "node/2-default", id: "-"}]
       }, 'my-new-circuit');

       circuit.getOnTerminated().then((result) => {
           console.log("flow terminated");
           setTimeout(() => buildCore(), 5000);
       });

   } catch (error: any) {
       console.log('FAIL TO build circuit with error: ', error);
       setTimeout(() => buildCore(), 5000);
   }

};

setTimeout(() => buildCore(), 5000);






