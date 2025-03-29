
import lodash from "lodash";
const { forOwn } = lodash;

import {logger} from "../helpers/logger.class";

import {WhiskConnectedNode} from "./whisk-connected-node.class";
import {WhiskConduit} from "./whisk-conduit.class";
import {WhiskDataConverter} from "../helpers/converter.class";
import {WhiskConnection, WhiskConnectionRepository} from "./whisk-repository.class";
import {INIT_TIMEOUT_DELAY, WhiskNodeCircuit, WhiskNodeCircuitImport} from "../types/flow.types";


export class WhiskCircuit {

    private connectedNodes: {[nodeId: string]: WhiskConnectedNode } = {};
    private conduits : WhiskConduit[] = [];

    private onTerminateResolver : any;
    private onTerminated = new Promise<true>(resolve => this.onTerminateResolver = resolve);


    constructor(private connections: WhiskConnectionRepository) {
    }

    async build(_flow: WhiskNodeCircuitImport) {

        const flow = WhiskDataConverter.convertFlowFromImport(_flow);

        const matchingConnections =  this.connections.findMatchingWhiskConnections(flow);
        logger.info(matchingConnections);

        /* Node initialization*/
        const initializeNodes = Promise.all(this.buildFlowInitialize(matchingConnections, flow));

        const timeout = new Promise((resolve, reject) => {
            setTimeout(() => { reject(new Error('Operation timed out after 15 seconds')); }, INIT_TIMEOUT_DELAY);
        });

        try {
            // Await all responses and log them once everything is processed
            const timedResults = await Promise.race([initializeNodes, timeout]);
            logger.info('All connections have responded:', timedResults);
        } catch (error) {
            logger.error('Operation timed out or encountered an error:', error);
            throw new Error('Timed out waiting for connections to initialize.');
        }

        /* Node conduit connection */
        flow.connections.forEach(connection => {
            const conduit = new WhiskConduit(connection, this.connectedNodes);
            // push connections asyncronously.
            conduit.attachConduit();
            this.conduits.push(conduit);
        })

        forOwn(this.connectedNodes, (node) => {
            node.getOnAborted().then(() =>  {
                this.abortAllConnections();
                this.terminateAllConduits()
            });
            node.setAllConnected();
        })

    }

    public getOnTerminated(): Promise<true> {
        return this.onTerminated;
    }

    public abort() {
        this.abortAllConnections();
    }

    private abortAllConnections() {

        forOwn(this.connectedNodes, (node) => {
            node.abort();
        })

        this.onTerminateResolver(true);
    }

    private terminateAllConduits() {

        this.conduits.forEach(conduit => {
            conduit.detachConduit()
        })

    }

    /**
     * Initializes the flow by sending requests through matching connections.
     *
     * This method iterates over a collection of matching connections, sends initialization data
     * to each connection's data adapter using its options or configurations, and collects the responses as promises.
     * It logs information about successful responses and errors encountered during the process.
     *
     * @param {Object} matchingConnections A dictionary where keys are node IDs (strings) and values are WhiskConnection objects,
     *                                     representing the connections associated with those nodes.
     * @param {WhiskNodeCircuit} flow Represents a flow circuit containing nodes. Each node has an ID and a corresponding flow element.
     * @return {Array} An array of promises, each containing the URI of the connection and its response data.
     */
    buildFlowInitialize(matchingConnections:  { [p: string]: WhiskConnection }, flow: WhiskNodeCircuit): Array<any> {
        // Prepare an array of promises to await all responses from connections
        const responsePromises : Promise<any>[] = [];

        // Use dictionary comprehension to iterate over the matching connections

        forOwn(matchingConnections,(connection, nodeId) => {
            const node = flow.nodes.find(node => node.id === nodeId);

            if (!node) { throw new Error(`Node with ID ${nodeId} not found in matching connections.`); }
            const connectedNode = this.connectedNodes[nodeId] = new WhiskConnectedNode(connection, node);
            responsePromises.push(connectedNode.initialize());
        })

        return responsePromises;
    }



}