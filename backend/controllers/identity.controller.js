import {
    registerIdentity,
    getAllIdentities,
    approveIdentity
} from "../services/identity.service.js";



const register = async (req,res)=>{

    try{

        const {
            alias,
            type,
            allowedActions=[]
        } = req.body;


        if(!alias || !type){
            return res.status(400).json({
                error:"alias + type required"
            });
        }


        if(
            !["operator","machine"]
            .includes(type)
        ){
            return res.status(400).json({
                error:"invalid type"
            });
        }


        const result =
            await registerIdentity({
                alias,
                type,
                allowedActions
            });


        res.json({
            success:true,
            ...result
        });


    }catch(error){

        res.status(500).json({
            error:error.message
        });

    }
};



const getAll = async(req,res)=>{

    try{

        const data =
            await getAllIdentities();

        res.json(data);

    }catch(error){

        res.status(500).json({
            error:error.message
        });

    }

};

const approve = async(req,res)=>{

    try {

        const { did } = req.body;


        if(!did){
            return res.status(400).json({
                error:"DID required"
            });
        }


        const result =
            await approveIdentity(did);


        res.json({
            success:true,
            identity:result
        });


    } catch(error){

        res.status(500).json({
            error:error.message
        });

    }

};


export {
    register,
    getAll,
    approve
};