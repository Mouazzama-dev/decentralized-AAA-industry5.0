import NetworkIncident from "../models/NetworkIncident.js";


let activeIncident = null;



const createNetworkIncident = async(reason)=>{


    if(activeIncident)
        return;


    const incident =
    await NetworkIncident.create({

        incidentId:
        "INC_" + Date.now(),

        reason

    });


    activeIncident = incident._id;


    return incident;

};



const resolveNetworkIncident = async()=>{


    const incident =
    await NetworkIncident.findOne({
        status:"OPEN"
    });


    if(!incident)
        return;


    incident.resolvedAt =
    new Date();


    incident.duration =
    Math.floor(
        (
            incident.resolvedAt -
            incident.startedAt
        ) / 1000
    );


    incident.status="CLOSED";


    await incident.save();

};


export {
    createNetworkIncident,
    resolveNetworkIncident
};