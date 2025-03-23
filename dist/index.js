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
const express_1 = __importDefault(require("express"));
const cors = require('cors');
const app = (0, express_1.default)();
const port = parseInt(process.env['WW_RUNTIME_PORT'] || '3000');
app.use(cors({
    origin: process.env['WW_CORS_ORIGIN'] || '*', // Allow all origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allow the standard HTTP methods
    preflightContinue: true,
    optionsSuccessStatus: 204 // Some legacy
}));
// Middleware to parse JSON bodies from POST requests
app.use(express_1.default.json());
// Define a simple route
app.get('/', (req, res) => {
    res.send('Hello World!');
});
// Route handler for POST /flow/:id
app.post('/flow/:id', (req, res) => {
    const flowId = req.params.id;
    const data = req.body;
    // Check if the required field 'flow' is present in the body
    if (!data.flow) {
        return res.status(400).json({ error: 'Missing required field `flow`' });
    }
    console.log(`Received data for flow ID ${flowId}:`, data);
    // Respond with a success status and the received data
    res.status(200).json({ message: 'Data received', data: data });
});
// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
