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


import {WhiskNodeCircuit, WhiskNodeCircuitImport} from "../types/flow.types";

export class WhiskDataConverter {


    /**
     * Converts a flow structure from an import-friendly format into the internal format
     * by transforming connection strings (like "node-x-y-default") into structured objects.
     *
     * This method is intended to safely parse legacy or file-based flow definitions and
     * normalize them for internal use.
     *
     * @param {WhiskNodeCircuitImport} flow - The imported flow definition using dash-separated connection strings.
     * @returns {WhiskNodeCircuit} - A flow object with structured connections.
     * @throws {Error} If a connection string is malformed and doesn't follow the expected pattern.
     */
    public  static convertFlowFromImport(flow: WhiskNodeCircuitImport) : WhiskNodeCircuit {

        // Regex captures: nodeId = everything up to the last dash, pin = final segment

        const connectionRegex = /^(.+)-([^-\s]+)$/;

        return {
            ...flow,
            connections: (flow.connections).map(({ from, to, id }) => {
                const fromMatch = from.match(connectionRegex);
                const toMatch = to.match(connectionRegex);

                if (!fromMatch || !toMatch) {  throw new Error(`Invalid connection format: "${from}" → "${to}"`); }

                return {
                    from: { nodeId: fromMatch[1], pin: fromMatch[2] },
                    to: { nodeId: toMatch[1], pin: toMatch[2] },
                    id
                };
            })
        };
    }

}