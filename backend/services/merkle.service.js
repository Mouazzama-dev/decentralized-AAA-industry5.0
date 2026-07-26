import crypto from "crypto";


const hashData = (data)=>{

    return crypto
        .createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");

};



const generateMerkleRoot = (events)=>{


    let hashes =
        events.map(event =>
            hashData(event)
        );



    while(hashes.length > 1){


        const nextLevel = [];



        for(
            let i=0;
            i<hashes.length;
            i += 2
        ){


            const left =
                hashes[i];


            const right =
                hashes[i+1]
                || left;



            nextLevel.push(
                hashData(
                    left + right
                )
            );

        }


        hashes = nextLevel;

    }


    return hashes[0];

};



export {
    generateMerkleRoot
};