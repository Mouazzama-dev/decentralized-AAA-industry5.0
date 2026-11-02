import {
    registerIdentity,
    getAllIdentities,
    approveIdentity
} from "../services/identity.service.js";
import {
    addTrustedIssuer,
    getTrustedIssuersDetail,
    cacheDidDocument,
    listCachedDIDDocuments
} from "../services/trust.service.js";



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


const addTrust = async (req, res) => {
    try {
        const { did, role } = req.body;
        if (!did) return res.status(400).json({ error: "did required" });
        const validRoles = ["localAdmin", "platformRoot", "factoryDid"];
        const resolvedRole = validRoles.includes(role) ? role : "localAdmin";
        const issuers = await addTrustedIssuer({ did, role: resolvedRole });
        res.json({ success: true, trustedIssuers: issuers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getTrust = async (req, res) => {
    try {
        const issuers = await getTrustedIssuersDetail();
        res.json({ trustedIssuers: issuers });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// C4: manually (re-)cache a DID document for offline VC verification.
// Useful when a Platform Root DID is rotated or when cache needs refreshing.
const cacheRootKey = async (req, res) => {
    try {
        const { did } = req.body;
        if (!did) return res.status(400).json({ error: "did required" });
        const document = await cacheDidDocument(did);
        const cached = await listCachedDIDDocuments();
        res.json({ success: true, did, cachedAt: new Date(), totalCached: cached.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getCachedKeys = async (req, res) => {
    try {
        const cached = await listCachedDIDDocuments();
        res.json({ count: cached.length, cachedDIDs: cached });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export {
    register,
    getAll,
    approve,
    addTrust,
    getTrust,
    cacheRootKey,
    getCachedKeys
};