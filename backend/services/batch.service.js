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


    // One unique ID for this batch
    const batchId =
        `batch_${Date.now()}`;


    const ids =
        events.map(
            event => event.id
        );


    // Lock these events into this batch
    await db.run(
        `
        UPDATE events

        SET
            status='BATCHED',
            batchId=?

        WHERE id IN (${ids.map(()=>"?").join(",")})

        `,
        [
            batchId,
            ...ids
        ]
    );


    return {

        batchId,

        events

    };

};


export {
    createBatch
};