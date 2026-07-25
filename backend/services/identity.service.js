import { agent } from "../../agent.js";
import IdentityModel from "../models/Identity.js";


const registerIdentity = async ({
    alias,
    type,
    allowedActions = []
}) => {

    const identity = await agent.didManagerCreate({
        alias,
        provider: "did:ethr:sepolia"
    });


    let store = await IdentityModel.findOne({
        key: "main_store"
    });


    if (!store) {
        store = await IdentityModel.create({
            key: "main_store"
        });
    }


    store.pending.push({
        alias,
        did: identity.did,
        type,
        status: "PENDING",
        allowedActions:
            type === "machine"
                ? allowedActions
                : []
    });


    await store.save();


    return {
        did: identity.did,
        status: "PENDING"
    };
};



const getAllIdentities = async () => {

    let store = await IdentityModel.findOne({
        key: "main_store"
    });


    if (!store) {

        store = await IdentityModel.create({
            key:"main_store",
            operators:[],
            machines:[],
            pending:[]
        });

    }


    return {
        operators: store.operators,
        machines: store.machines,
        pending: store.pending
    };
};

const approveIdentity = async (did) => {

    const store = await IdentityModel.findOne({
        key: "main_store"
    });


    if (!store) {
        throw new Error("Identity store not found");
    }


    const index = store.pending.findIndex(
        item => item.did === did
    );


    if (index === -1) {
        throw new Error("DID not found in pending list");
    }


    const identity = store.pending[index];


    identity.status = "ACTIVE";


    if (identity.type === "operator") {

        store.operators.push(identity);

    } else if (identity.type === "machine") {

        store.machines.push(identity);

    }


    store.pending.splice(index,1);


    await store.save();


    return identity;
};


export {
    registerIdentity,
    getAllIdentities,
    approveIdentity
};