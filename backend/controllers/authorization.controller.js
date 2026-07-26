import {
    checkAuthorization
} from "../services/authorization.service.js";



const authorize = async(req,res)=>{


    try{


        const result =
            await checkAuthorization(req.body);


        res.json(result);


    }
    catch(error){

        res.status(500).json({
            error:error.message
        });

    }


};



export {
    authorize
};