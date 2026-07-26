import { getDB } from "../database/sqlite.js";


const createBatch = async(limit = 10)=>{


    const db = getDB();


    const events = await db.all(
        `
        SELECT *
        FROM events
        WHERE status='PENDING'
        ORDER BY id ASC
        LIMIT ?
        `,
        [limit]
    );


    if(events.length === 0){

        return null;

    }


    return events;

};



export {
    createBatch
};