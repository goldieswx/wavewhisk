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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
class WhiskLogger {
    constructor() {
        this.logger = null;
        this.logger = winston_1.default.createLogger({
            level: 'info', // Default log level, can be overridden by options in methods below
            format: winston_1.default.format.json(),
            defaultMeta: { service: 'whisk-service' },
            transports: [
                new winston_1.default.transports.Console() // Log to console by default
            ]
        });
    }
    info(message, meta = {}) {
        this.logger.info(message, meta);
    }
    error(message, meta = {}) {
        this.logger.error(message, meta);
    }
    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }
}
exports.logger = new WhiskLogger();
