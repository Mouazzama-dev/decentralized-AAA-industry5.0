import {
    issuePermit,
    verifyCredential
} from "../services/vc.service.js";



const issue = async(req,res)=>{


    try{

        const {
            issuerDid,
            holderDid,
            machineDid,
            actions
        } = req.body;


        const credential =
            await issuePermit({
                issuerDid,
                holderDid,
                machineDid,
                actions
            });


        res.json({

            success:true,

            credential

        });


    }catch(error){

        res.status(500).json({
            error:error.message
        });

    }

};



const verify = async(req,res)=>{


    try{


        const result =
            await verifyCredential(
                req.body.credential
            );


        res.json(result);


    }catch(error){

        res.status(500).json({
            error:error.message
        });

    }

};



export {
    issue,
    verify
};