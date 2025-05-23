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


import { randomBytes } from 'crypto';

class TokenGenerator {
    private static readonly TOKEN_LENGTH = 8; // 64 bits / 8 = 8 bytes

    public generateStringToken(): string {
        return randomBytes(TokenGenerator.TOKEN_LENGTH).toString('hex');
    }

    public generateToken(): Buffer {
        return randomBytes(TokenGenerator.TOKEN_LENGTH);
    }
}

export const tokenGenerator = new TokenGenerator();

/*
    // Usage example:
    const tokenGen = new TokenGenerator();
    const token = tokenGen.generateToken();
    console.log('Generated Token:', token.toString('hex')); // Convert buffer to hex string for display
*/
