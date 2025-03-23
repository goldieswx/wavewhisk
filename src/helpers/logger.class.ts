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

import winston, {Logger} from 'winston';

class WhiskLogger {

    private logger : Logger = null;

    constructor() {
        this.logger = winston.createLogger({
            level: 'info', // Default log level, can be overridden by options in methods below
            format: winston.format.json(),
            defaultMeta: { service: 'whisk-service' },
            transports: [
                new winston.transports.Console() // Log to console by default
            ]
        });
    }

    info(message: any, meta = {}) {
        this.logger.info(message, meta);
    }

    error(message: any, meta = {}) {
        this.logger.error(message, meta);
    }

    warn(message: any, meta = {}) {
        this.logger.warn(message, meta);
    }
}


export const logger = new WhiskLogger();

