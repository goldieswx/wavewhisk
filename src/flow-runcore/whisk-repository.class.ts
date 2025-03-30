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
    HEARTBEAT_MAX_DELAY_MS, SCHEDULER_RESTART,
    WhiskNodeCircuit
} from "../types/flow.types.js";
import {tokenGenerator} from "../helpers/token-generator.class";
import {SERIALZER_MSGPACK, whishSerializer} from "./whisk-serializer.class";
import {clearInterval} from "node:timers";
import lodash from "lodash";
const { pull } = lodash;


export interface WhiskConnectionOptions {

    failStrategy: {
        type: 'delete' | 'restart';
        restartBackOffInitialDelayMs ?: number;
        maxRestarts : 5;
    }

}


export type WhiskConnectionStatus = 'healthy' | 'error' | 'initializing';
/**
 * Manages a connection to a whisk service and its health status.
 */
export class WhiskConnection {

    lastHeartBeat: Date = null;
    dataAdapter  = new WhiskZMQDataAdapter(this.addressableUri);

    private status : WhiskConnectionStatus = 'initializing';
    private $_status = new BehaviorSubject<WhiskConnectionStatus>(this.status);
    public readonly $status = this.$_status.asObservable();

    private destroyResolver : any;private timer : any;
    public readonly onDestroy: Promise<true> = new Promise((resolve, reject) => this.destroyResolver = resolve);

    constructor(public readonly addressableUri: string, public registeredClasses: string[] = [], public options: WhiskConnectionOptions) {

           logger.info(`WhiskConnection created for ${addressableUri}`);

           this.$status.subscribe((status) => {

               if (status === 'initializing') {
                      logger.info('Initializing...', addressableUri);
                      setTimeout(async () => {
                          try {
                              await this.dataAdapter.open();
                              await this.sendSchedulerInitialize();
                              this.updateStatus('healthy');
                          } catch (e: any) {
                              logger.warn('Couldn\'t initialize connection',e);
                              this.updateStatus('error');
                          }
                      });
               }
               if (status === 'error') {
                       if (this.timer) {
                           clearInterval(this.timer);
                           this.timer = null;
                       }
                       logger.warn(`Connection failed for ${addressableUri}, retrying in 5s`);
                       setTimeout(async () => {
                          this.updateStatus('initializing');
                       }, 5000);
                       this.dataAdapter.close();
               }
               if (status === 'healthy') {
                   if (this.timer) {
                       clearInterval(this.timer);
                       this.timer = null;
                   }
                   this.timer = setInterval(() => this.sendHeartBeatEvent(), HEARTBEAT_ASKRATE_DELAY_MS);
               }
           });
    }


    public getStatus(): WhiskConnectionStatus {
        return this.$_status.value;
    }

    /**
     * Destroys the connection and its data adapter.
     */
    destroy() {
          if (this.timer) {
              clearInterval(this.timer);
          }
          this.destroyResolver();

          logger.info(`WhiskConnection destroyed for ${this.addressableUri}`);
          this.dataAdapter.destroy();
    }

    getLastHeartbeatDelay(): number {

        if (this.lastHeartBeat === null) {
            return null;
        }
        return (new Date().getTime() - (this.lastHeartBeat).getTime());
    }

    private sendHeartBeat() {
        // [identity, token,  _nodeRef, inputId, header, data ]
        const notUsed = Buffer.alloc(0);

        this.dataAdapter
            .sendAndReceive(
                tokenGenerator.generateToken(),
                [notUsed, notUsed, whishSerializer.createShortHeader(HEARTBEAT_EVENT, SERIALZER_MSGPACK)])
             .then(() => this.lastHeartBeat = new Date())
             .catch(error => logger.error(`WhiskConnection sendHeartBeat`, error));

    }

    private async sendSchedulerInitialize() {
        // [identity, token,  _nodeRef, inputId, header, data ]
        const notUsed = Buffer.alloc(0);

        await this.dataAdapter.sendAndReceive(
                tokenGenerator.generateToken(),
                [notUsed, notUsed, whishSerializer.createShortHeader(SCHEDULER_RESTART, SERIALZER_MSGPACK)]);

        this.lastHeartBeat = new Date();

           //  .catch(error => logger.error(`WhiskConnection send SCHEDULER_RESTART`, error));
    }

    private updateStatus(status: WhiskConnectionStatus) {
         this.status = status;
         this.$_status.next(status);
    }

    private sendHeartBeatEvent() {

        const lastHeartbeatDelay = this.getLastHeartbeatDelay();
        if  ((lastHeartbeatDelay !== null) && (lastHeartbeatDelay >= HEARTBEAT_MAX_DELAY_MS)) {
            logger.error(`HeartBeat overflow. ${this.addressableUri}`);
            this.updateStatus('error');
            return;
        }
        this.sendHeartBeat();

    }
}



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