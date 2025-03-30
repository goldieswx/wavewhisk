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
import {BehaviorSubject, Subscription} from "rxjs";
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
 * Manages a connection to a Whisk scheduler.
 * Handles connection lifecycle, automatic retries, heartbeat monitoring, and status updates.
 */
export class WhiskConnection {

    /** Timestamp of the last successful heartbeat */
    lastHeartBeat: Date = null;
    dataAdapter  = new WhiskZMQDataAdapter(this.addressableUri);

    private status : WhiskConnectionStatus = 'initializing';
    private $_status = new BehaviorSubject<WhiskConnectionStatus>(this.status);

    /**
     * Observable stream of current connection status
     * @type {import('rxjs').Observable<WhiskConnectionStatus>}
     */
    public readonly $status = this.$_status.asObservable();

    private sub = new Subscription();
    private errorCount = 0;
    private destroyResolver : any;private timer : any;

    /**
     * Promise that resolves when the connection is destroyed
     * @type {Promise<true>}
     */
    public readonly onDestroy: Promise<true> = new Promise((resolve, reject) => this.destroyResolver = resolve);

    /**
     * Creates a new WhiskConnection instance.
     * Automatically starts initialization and retry logic.
     *
     * @param {string} addressableUri - ZMQ address to connect to.
     * @param {string[]} [registeredClasses=[]] - Registered class types for this connection.
     * @param {WhiskConnectionOptions} options - Connection configuration.
     */
    constructor(public readonly addressableUri: string, public registeredClasses: string[] = [], public options?: WhiskConnectionOptions) {

        logger.info(`WhiskConnection created for ${addressableUri}`);

        this.sub = this.$status.subscribe((status) => {
            switch (status) {
                case 'initializing':
                    this.handleInitializingState();
                    break;

                case 'error':
                    this.handleErrorState();
                    break;

                case 'healthy':
                    this.handleHealthyState();
                    break;
            }
        });


    }

    /**
     * Handles initialization logic for the connection.
     */
    private async handleInitializingState(): Promise<void> {
        logger.info('Initializing...', this.addressableUri);

        setTimeout(async () => {
            try {
                await this.dataAdapter.open();
                await this.sendSchedulerInitialize();
                this.updateStatus('healthy');
            } catch (e: any) {
                logger.warn(`Couldn't initialize connection`, e);
                this.updateStatus('error');
            }
        });
    }

    /**
     * Handles the error state: closes connection and schedules retry.
     */
    private handleErrorState(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        logger.warn(`Connection failed for ${this.addressableUri}, retrying...`);

        setTimeout(() => {
            this.updateStatus('initializing');
        }, this.getRestartDelay());

        this.dataAdapter.close();
    }

    /**
     * Handles the healthy state: starts heartbeat monitoring.
     */
    private handleHealthyState(): void {
        this.errorCount = 0;

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.timer = setInterval(() => this.sendHeartBeatEvent(), HEARTBEAT_ASKRATE_DELAY_MS);
    }

    /**
     * Calculates restart delay using exponential backoff with an upper cap.
     * @returns {number} The delay in milliseconds before the next retry.
     */
    private getRestartDelay(): number {

        const backoffDelay = this.options?.failStrategy?.restartBackOffInitialDelayMs || 5000;
        const backoffMaxDelay = this.options?.failStrategy?.restartBackOffMaxDelayMs || 60000;

        if (this.errorCount === 0 ) {
            return 0;
        }
        const cappedErrorCount = Math.min(this.errorCount-1, 16);
        return Math.min(backoffDelay * (2 ** cappedErrorCount), backoffMaxDelay);

    }

    /**
     * Returns the current connection status.
     * @returns {WhiskConnectionStatus}
     */
    public getStatus(): WhiskConnectionStatus {
        return this.$_status.value;
    }

    /**
     * Destroys the connection and associated timers and resources.
     */
    destroy() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.destroyResolver();

        logger.info(`WhiskConnection destroyed for ${this.addressableUri}`);

        this.dataAdapter.destroy();
        this.sub.unsubscribe();
    }

    /**
     * Returns the delay since the last successful heartbeat.
     * @returns {number | null} Milliseconds since last heartbeat or `null` if never received.
     */
    getLastHeartbeatDelay(): number {

        if (this.lastHeartBeat === null) {
            return null;
        }
        return (new Date().getTime() - (this.lastHeartBeat).getTime());
    }

    /**
     * Sends a heartbeat message to the connected scheduler.
     * Updates `lastHeartBeat` on success.
     * Logs errors on failure.
     */
    private sendHeartBeat() {
        // [identity, token,  _nodeRef, inputId, header, data ]
        const notUsed = Buffer.alloc(0);

        this.dataAdapter
            .sendAndReceive(
                tokenGenerator.generateToken(),
                [notUsed, notUsed, whishSerializer.createShortHeader(HEARTBEAT_EVENT, SERIALZER_MSGPACK)])
            .then(() => this.lastHeartBeat = new Date())
            .catch(error => logger.debug(`WhiskConnection sendHeartBeat`, error));

    }

    /**
     * Sends the initial scheduler "restart" handshake to establish the connection.
     * Updates `lastHeartBeat` on success.
     */
    private async sendSchedulerInitialize() {
        // [identity, token,  _nodeRef, inputId, header, data ]
        const notUsed = Buffer.alloc(0);

        await this.dataAdapter.sendAndReceive(
            tokenGenerator.generateToken(),
            [notUsed, notUsed, whishSerializer.createShortHeader(SCHEDULER_RESTART, SERIALZER_MSGPACK)]);

        this.lastHeartBeat = new Date();
    }

    /**
     * Updates internal status and notifies observers via RxJS subject.
     * @param {WhiskConnectionStatus} status - New status to apply.
     */
    private updateStatus(status: WhiskConnectionStatus) {

        this.status = status;
        this.$_status.next(status);
    }

    /**
     * Verifies if the heartbeat interval has overflowed,
     * and if so, transitions to 'error' state.
     */
    private sendHeartBeatEvent() {

        const lastHeartbeatDelay = this.getLastHeartbeatDelay();
        if  ((lastHeartbeatDelay !== null) && (lastHeartbeatDelay >= HEARTBEAT_MAX_DELAY_MS)) {
            logger.debug(`HeartBeat overflow. ${this.addressableUri}`);
            this.updateStatus('error');
            return;
        }
        this.sendHeartBeat();

    }
}
