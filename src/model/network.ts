

/**
 * a machine that can connect to a internal network
 */
export interface Gateway {
    id: string;
    name: string;
    labels: string[];
    networkId?: string;
    isEnabled?: boolean;
    insertDate: string;
    updateDate: string;
}


/**
 * @summary a group of @see Gateway s
 */
export interface Network {
    id: string;
    name: string;
    labels: string[];
    clientNetwork: string;
    serviceNetwork: string;
    insertDate: string;
    updateDate: string;

}

/***
 * @summary clone only needed parameters
 */
export function cloneNetwork(net: Network): Network {
    return {
        id: net.id, clientNetwork: net.clientNetwork, labels: net.labels,
        name: net.name, serviceNetwork: net.serviceNetwork, insertDate: net.insertDate, updateDate: net.updateDate


    }
}

/**
 * @summary cppy only needed parameters
 * @param gate 
 * @returns 
 */
export function cloneGateway(gate: Gateway): Gateway {
    return {
        id: gate.id, labels: gate.labels, name: gate.name,
        networkId: gate.networkId, isEnabled: gate.isEnabled,
        insertDate: gate.insertDate, updateDate: gate.updateDate
    }
}