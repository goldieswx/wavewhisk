
import {WhiskConnection} from "./whisk-repository.class";
import {tokenGenerator} from "../helpers/token-generator.class";
import {INIT_FLOW_ELEMENT, WhiskNode} from "../types/flow.types";
import {logger} from "../helpers/logger.class";

/**
 * Represents a node connected to a whisk service with specific communication capabilities.
 */
export class WhiskConnectedNode {

    constructor(
        private whiskConnection: WhiskConnection,
        private node: WhiskNode
    ) {}


    public async onInput(inputId: string, message: Buffer[]): Promise<void> {
    }


    public async push(inputId: string, message: Buffer[]): Promise<void> {

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
}

