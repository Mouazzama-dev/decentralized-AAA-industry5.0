import { getDB } from "../database/sqlite.js";


const createAuditEvent = async ({
    operatorDid,
    deviceDid,
    action
}) => {


    const db = getDB();


    const timestamp =
        new Date().toISOString();



    const result = await db.run(

        `
        INSERT INTO events
        (
            operatorDid,
            deviceDid,
            action,
            timestamp,
            status
        )

        VALUES
        (?, ?, ?, ?, ?)

        `,

        [
            operatorDid,
            deviceDid,
            action,
            timestamp,
            "PENDING"
        ]

    );


    return {

        id: result.lastID,

        operatorDid,

        deviceDid,

        action,

        timestamp,

        status:"PENDING"

    };

};



const getPendingEvents = async()=>{


    const db = getDB();


    const events =
        await db.all(

        `
        SELECT *
        FROM events
        WHERE status='PENDING'
        ORDER BY id ASC
        `

    );


    return events;

};



export {

    createAuditEvent,

    getPendingEvents

};