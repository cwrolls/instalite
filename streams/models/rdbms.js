import fs from 'fs';
import mysql from 'mysql2/promise';
import process from 'process';

const configFile = fs.readFileSync('config.json', 'utf8');
const config = JSON.parse(configFile);

import dotenv from 'dotenv';
dotenv.config()


var the_db = null;


class RelationalDB {
    conn = null;
    dbconfig = null;

    constructor() {
        this.dbconfig = config.database;
        if (process.env.DATABASE_USER) {
            this.dbconfig.host = process.env.DATABASE_SERVER;
            this.dbconfig.database = process.env.DATABASE_NAME;
            this.dbconfig.user = process.env.DATABASE_USER;
            this.dbconfig.password = process.env.DATABASE_PASSWORD;
        }
    }

    setInfo(dbserver, dbname, dbuser, dbpassword) {
        this.dbconfig = config.database;
        this.dbconfig.host = dbserver;
        this.dbconfig.database = dbname;
        this.dbconfig.user = dbuser;
        this.dbconfig.password = dbpassword;

        return this;
    }

    async connect() {
        try {
            if (this.conn != null) 
                return this;
    
            console.log('dbconfig:', JSON.stringify(this.dbconfig, null, 2));
            console.log(`new connecting to the database ${this.dbconfig?.host}/${this.dbconfig?.database}/${this.dbconfig?.user}`);
                        
            const conn = await mysql.createConnection(this.dbconfig);
                
            if (this.conn == null) {
                console.log("New connection used");
                this.conn = conn;
            } else {
                console.log("New connection discarded");
                await conn.end();
            }
    
            console.log(`exit createConnection`);
            return this;
    
        } catch (error) {
            console.error("Error connecting to the database:", error);
            throw error;
        }
    }

    close() {
        this.conn.end();
        this.conn = null;
        the_db = null;
    }


    async send_sql(sql, params = []) {
        // console.log(sql, params);
        return this.conn.query(sql, params);
    }



    async create_tables(query, params = []) {
        return this.send_sql(query, params);
    }


    async insert_items(query, params = []) {
        var result = await this.send_sql(query, params);

        return result.affectedRows;
    }
};


function set_db_connection(db) {
    the_db = db;
}

function get_db_connection() {
    if (the_db) {
        return the_db;
    }
    the_db = new RelationalDB();
    return the_db;
}



export {
    get_db_connection,
    set_db_connection,
    RelationalDB
}

