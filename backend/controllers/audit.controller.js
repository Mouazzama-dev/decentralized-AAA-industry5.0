import {
    createAuditEvent,
    getPendingEvents
} from "../services/audit.service.js";



const createEvent = async(req,res)=>{


    try {


        const {

            operatorDid,

            deviceDid,

            action

        } = req.body;



        if(
            !operatorDid ||
            !deviceDid ||
            !action
        ){

            return res.status(400).json({

                error:
                "operatorDid, deviceDid and action required"

            });

        }



        const event =
            await createAuditEvent({

                operatorDid,

                deviceDid,

                action

            });



        res.json({

            success:true,

            event

        });



    }
    catch(error){

        res.status(500).json({

            error:error.message

        });

    }

};





const pendingEvents = async(req,res)=>{


    try{


        const events =
            await getPendingEvents();



        res.json(events);



    }
    catch(error){

        res.status(500).json({

            error:error.message

        });

    }

};



export {

    createEvent,

    pendingEvents

};