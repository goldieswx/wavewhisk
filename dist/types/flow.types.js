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
exports.INIT_TIMEOUT_DELAY = exports.DESTROY_EVENT = exports.ERROR_EVENT = exports.CAN_SEND_NEXT = exports.CURRENT_EVENT = exports.INIT_FLOW_ELEMENT = void 0;
exports.INIT_FLOW_ELEMENT = 0x4026;
exports.CURRENT_EVENT = 0x8200;
exports.CAN_SEND_NEXT = 0x8001;
exports.ERROR_EVENT = 0xFFFF;
exports.DESTROY_EVENT = 0x82FF;
exports.INIT_TIMEOUT_DELAY = parseInt(process.env['WW_INIT_TIMEOUT_DELAY'] || '15000');
