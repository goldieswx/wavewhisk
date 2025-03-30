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


import {WhiskZMQDataAdapter} from "./data-adapters/whisk-zmq-data-adapter.class";
import {BehaviorSubject} from "rxjs";
import {logger} from "../helpers/logger.class";
import {clearInterval} from "node:timers";
import {
    HEARTBEAT_ASKRATE_DELAY_MS,
    HEARTBEAT_EVENT,
    HEARTBEAT_MAX_DELAY_MS,
    SCHEDULER_RESTART
} from "../types/flow.types";
import {tokenGenerator} from "../helpers/token-generator.class";
import {SERIALZER_MSGPACK, whishSerializer} from "./whisk-serializer.class";


export interface WhiskConnectionOptions {

    failStrategy: {
        restartBackOffInitialDelayMs ?: number;
        restartBackOffMaxDelayMs ?: number;
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


    private errorCount = 0;
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
                }, this.getRestartDelay());
                this.dataAdapter.close();
            }
            if (status === 'healthy') {
                this.errorCount = 0;
                if (this.timer) {
                    clearInterval(this.timer);
                    this.timer = null;
                }
                this.timer = setInterval(() => this.sendHeartBeatEvent(), HEARTBEAT_ASKRATE_DELAY_MS);
            }
        });
    }


    private getRestartDelay(): number {

        const backoffDelay = this.options?.failStrategy?.restartBackOffInitialDelayMs || 5000;
        const backoffMaxDelay = this.options?.failStrategy?.restartBackOffMaxDelayMs || 60000;

        if (this.errorCount === 0 ) {
            return 0;
        }
        const cappedErrorCount = Math.min(this.errorCount-1, 16);
        return Math.min(backoffDelay * (2 ** cappedErrorCount), backoffMaxDelay);

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
