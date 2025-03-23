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


export const INIT_FLOW_ELEMENT = 0x8123;
export const CURRENT_EVENT = 0x8124;
export const CAN_SEND_NEXT = 0x8125;

export const INIT_TIMEOUT_DELAY = parseInt(process.env['WW_INIT_TIMEOUT_DELAY'] || '15000');

/*
* Flow I/O definition
* */
export interface OutletConduit {
    from: string;
    to: string;
    id: string;
}

export interface WhiskNodeOutlet {
    id: string;
    displayName: string;
}

/**
 * Flow Node definition
 */
export interface WhiskNode {

    position?: {
            x: number;
            y: number;
    },
    flowElement: {
        name: string;
        id: string;
        icon: string;
        options: any;
        type: 'pipe' | 'sink' | 'source';
    }
    id: string;
    inputs: WhiskNodeOutlet[];
    outputs: WhiskNodeOutlet[];
}

/**
 * Flow high level object.
 */
export interface WhiskNodeCircuit {
     nodes: WhiskNode[];
     connections: OutletConduit[];
}

