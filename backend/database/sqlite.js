import sqlite3 from "sqlite3";
import { open } from "sqlite";


let db;


const connectSQLite = async()=>{


    db = await open({

        filename:
        "./audit.db",

        driver:
        sqlite3.Database

    });


    console.log(
        "📦 SQLite Connected"
    );


    await db.exec(`

        CREATE TABLE IF NOT EXISTS events (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            operatorDid TEXT,

            deviceDid TEXT,

            action TEXT,

            timestamp TEXT,

            status TEXT DEFAULT 'PENDING',

            batchId TEXT,

            txHash TEXT

        )

    `);


    return db;

};



const getDB = ()=>{

    if(!db){

        throw new Error(
            "SQLite not initialized"
        );

    }

    return db;

};



export {
    connectSQLite,
    getDB
};