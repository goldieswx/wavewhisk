
import {WhiskConnection} from "./whisk-repository.class";
import {tokenGenerator} from "../helpers/token-generator.class";
import {CAN_SEND_NEXT, CURRENT_EVENT, INIT_FLOW_ELEMENT, WhiskNode} from "../types/flow.types";
import {logger} from "../helpers/logger.class";


export interface PinAttachment {
  callBackArray: ((msg: Buffer[]) => Promise<void>)[]
}

/**
 * Represents a node connected to a whisk service with specific communication capabilities.
 */
export class WhiskConnectedNode {

    private outputPinAttachments : { [pinId: string]: PinAttachment } = {};

    private connected = true;
    private allConnectedResolve : any = null;
    private allConnected = new Promise((res) => this.allConnectedResolve = res);

    constructor(
        private whiskConnection: WhiskConnection,
        private node: WhiskNode
    ) {}

    public setAllConnected() {
        this.allConnectedResolve();
    }

    public async initialize() {

        try {
            // Send a request through the data adapter of the connection using its options or configurations
            const response =
                this.whiskConnection.dataAdapter
                    .sendAndReceive( tokenGenerator.generateToken(), [INIT_FLOW_ELEMENT, this.node.flowElement.options])
                    .then(() => {
                        logger.info(`[${this.node.id}] Received response from  ${ this.whiskConnection.addressableUri}:`, response);
                    });

            return response;
        } catch (error) {
            logger.error(`[${this.node.id}] Error with connection to ${ this.whiskConnection.addressableUri}:`, error);
        }

    }

    public onOutputPin(from: string, onOutputReady: (msg: Buffer[]) => Promise<void>) {

        const startLoop = !!this.outputPinAttachments[from]
        const pinAttach = this.outputPinAttachments[from] = this.outputPinAttachments[from] || { callBackArray: [] };

        pinAttach.callBackArray.push(onOutputReady);

        if (startLoop) { return pinAttach; }

        // start the async loop the first time.
        (async () => {
            await this.allConnected;
            logger.info(`[${this.node.id}] / output pin ${from} opened.`);
            while(this.connected) {
                const header = Buffer.alloc(8);
                header.writeUInt32LE(CAN_SEND_NEXT,0);

                const pinId = Buffer.from(from);
                // send an output ready & upon receive, signal all the output pin attachements that we are ready so thay
                // can do their async business.
                await this.whiskConnection.dataAdapter.sendAndReceive(tokenGenerator.generateToken(),[header,pinId]).then(
                    (msg) => {
                        const outputAcks = this.outputPinAttachments[from].callBackArray.map(fn => {
                            fn(msg)
                        })
                        return Promise.all(outputAcks);
                    },
                    (err) => {
                        logger.error(`[${this.node.id}] Error with output pin routing ${from} @ ${ this.whiskConnection.addressableUri}:`, err);
                        throw new Error(err);
                    }
                )
            }
            logger.info(`[${this.node.id}] / output pin ${from} closed.`);
        })();

        return pinAttach;

    }

    public async pushToInputPin(to: string, msg: Buffer[]) {

             const header = Buffer.alloc(8);
             header.writeUInt32LE(CURRENT_EVENT,0);

             const pinId = Buffer.from(to);
             return this.whiskConnection.dataAdapter.sendAndReceive(tokenGenerator.generateToken(),[header,pinId,...msg]);

    }
}

