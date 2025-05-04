///////////////
// NETS 2120 Sample Kafka Client
///////////////

import express from 'express';
import pkg from 'kafkajs';
import register_routes from './routes/register_routes.js';
import { get_db_connection } from './models/rdbms.js';

const { Kafka, CompressionTypes, CompressionCodecs } = pkg;
import SnappyCodec from 'kafkajs-snappy';

// Add snappy codec to the CompressionCodecs.
CompressionCodecs[CompressionTypes.Snappy] = SnappyCodec;

import fs from 'fs';
const configFile = fs.readFileSync('config.json', 'utf8');
import dotenv from 'dotenv';
dotenv.config();
const config = JSON.parse(configFile);

const app = express();
app.use(express.json());

// Database connection setup
const db = get_db_connection();

async function queryDatabase(query, params = []) {
    await db.connect();
    return db.send_sql(query, params);
}

const kafka = new Kafka({
    clientId: 'stream-app',
    brokers: config.bootstrapServers
});

const consumer = kafka.consumer({ 
    groupId: config.groupId, 
    bootstrapServers: config.bootstrapServers
});

const producer = kafka.producer();

var kafka_messages = [];

register_routes(app,producer,config);

async function processfederatedMessage(message) {

    try {
        const {post_json,attach} = JSON.parse(message.value.toString());
        
        if (!post_json || !post_json.username || !post_json.post_text || !post_json.source_site 
            || !post_json.post_uuid_within_site || !post_json.content_type) {
            return res.status(400).json({ 
                error: 'Required fields missing in post_json (username, source_site, post_text, post_uuid_within_site, content_type)' 
            });
            }

        const query = `
            INSERT INTO federated_posts (
                username, 
                source_site, 
                post_uuid_within_site, 
                post_text,
                content_type,
                attach_url
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        await queryDatabase(query, [
            post_json.username,
            post_json.source_site,
            post_json.post_uuid_within_site,
            post_json.post_text,
            post_json.content_type,
            attach || null
        ]);
        console.log('Federated post added to database');
    } catch (error) {
        console.error('Error processing federated message:', error);
    }
}

async function processBlueskyMessage(message) {
    try {
        const data = JSON.parse(message.value.toString());
        
        // Handle author data
        const authorQuery = `
            INSERT INTO Bluesky_authors (did, handle, display_name, avatar_url)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            handle = VALUES(handle),
            display_name = VALUES(display_name),
            avatar_url = VALUES(avatar_url)
        `;
        await queryDatabase(authorQuery, [
            data.author.did,
            data.author.handle,
            data.author.displayName,
            data.author.avatar
        ]);

        // Handle post data
        const embedJson = data.embed ? JSON.stringify(data.embed) : null;

        const postQuery = `
            INSERT INTO Bluesky_posts (
                uri, author_did, text, created_at,
                reply_count, repost_count, like_count,
                reply_to_uri, embded_image_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await queryDatabase(postQuery, [
            data.uri,
            data.author.did,
            data.text,
            new Date(data.created_at),
            data.replies,
            data.reposts,
            data.likes,
            data.reply || null,
            embedJson
        ]);

        console.log('Bluesky post processed successfully');
    } catch (error) {
        console.error('Error processing Bluesky message:', error);
    }
}

async function processKafkaMessage(topic, message) {
    const messageObj = {
        topic: topic,
        value: message.value.toString(),
        timestamp: new Date(parseInt(message.timestamp)).toISOString()
    };
    kafka_messages.push(messageObj);
    console.log(messageObj);

    if (topic === config.federatedTopic) {
        processfederatedMessage(message);
    } else if (topic === config.topic) {
        processBlueskyMessage(message);
    }
}

const run = async () => {
    await Promise.all([
        consumer.connect(),
        producer.connect()
    ]);

    console.log(`Following topics ${config.topic} and ${config.federatedTopic}`);
    
    await consumer.subscribe({ 
        topics: [config.topic, config.federatedTopic], 
        fromBeginning: true,
        compression: CompressionTypes.Snappy 
    });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            await processKafkaMessage(topic, message);
        },
    });
};

run().catch(console.error);

app.listen(config.port, () => {
    console.log(`App is listening on port ${config.port} -- you can GET and POST Kafka messages`);
});
