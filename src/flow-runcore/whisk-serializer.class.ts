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

import { pack as msgpackPack, unpack as msgpackUnpack } from 'msgpackr';

export const SERIALZER_MSGPACK = 0x1001;
export const SERIALZER_JSON = 0x1002;

class WhiskSerializer {
    private serializerTypes: { [key: number]: (data: any) => Buffer } = {};
    private deserializerTypes: { [key: number]: (buffer: Buffer) => any } = {};

    constructor() {
        this.registerSerializer(SERIALZER_MSGPACK, msgpackPack);
        this.registerDeserializer(SERIALZER_MSGPACK, msgpackUnpack);

        this.registerSerializer(SERIALZER_JSON, data => Buffer.from(JSON.stringify(data)));
        this.registerDeserializer(SERIALZER_JSON, buffer => JSON.parse(buffer.toString()));
    }

    private registerSerializer(constant: number, packFn: (data: any) => Buffer) {
        this.serializerTypes[constant] = packFn;
    }

    private registerDeserializer(constant: number, unpackFn: (buffer: Buffer) => any) {
        this.deserializerTypes[constant] = unpackFn;
    }


    public pack(header: Buffer, data: any): Buffer {
        const constant = header.readUInt32LE(0);
        return this.packNum(constant, data);
    }

    public unpack(header: Buffer, buffer: Buffer): any {
        const constant = header.readUInt32LE(0);
        return this.unpackNum(constant, buffer);
    }

    public packNum(constant: number, data: any): Buffer {
            if (this.serializerTypes[constant]) {
                return this.serializerTypes[constant](data);
            } else {
                throw new Error(`Unknown serializer type: ${constant}`);
            }
    }

    public unpackNum(constant: number, buffer: Buffer): number {
            if (this.deserializerTypes[constant]) {
                return this.deserializerTypes[constant](buffer);
            } else {
                throw new Error(`Unknown deserializer type: ${constant}`);
            }
    }

    public createShortHeader (actionId : number, serializationMethod: number): Buffer {
        const buffer = Buffer.alloc(8);
        buffer.writeUInt32LE(actionId, 0);  // Write the first 4 bytes (UInt LE)
        buffer.writeUInt32LE(serializationMethod, 4); // Write the second 4 bytes (UInt LE)
        return buffer;
    };
}


export const  whishSerializer = new WhiskSerializer();