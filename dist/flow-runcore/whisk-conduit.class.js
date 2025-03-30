"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhiskConduit = void 0;
const logger_class_1 = require("../helpers/logger.class");
class WhiskConduit {
    constructor(flowConnection, whiskConnectedNodes) {
        this.flowConnection = flowConnection;
        this.whiskConnectedNodes = whiskConnectedNodes;
        this.detachToken = null;
    }
    /**
     * Processes connections within the flow by sending messages and logging responses.
     */
    attachConduit() {
        const fromConnection = this.whiskConnectedNodes[this.flowConnection.from.nodeId];
        const toConnection = this.whiskConnectedNodes[this.flowConnection.to.nodeId];
        this.detachToken = fromConnection.onOutputPin(this.flowConnection.from.pin, (msg) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield toConnection.pushToInputPin(this.flowConnection.to.pin, msg);
            }
            catch (e) {
                logger_class_1.logger.debug(`Attached Conduit, push to pin ${this.flowConnection.to.pin}, error`, e);
            }
        }));
    }
    detachConduit() {
        if (this.detachToken) {
            const fromConnection = this.whiskConnectedNodes[this.flowConnection.from.nodeId];
            if (fromConnection) {
                fromConnection.detachPin(this.flowConnection.from.pin, this.detachToken);
                this.detachToken = null;
            }
        }
    }
}
exports.WhiskConduit = WhiskConduit;
