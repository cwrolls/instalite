import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { OpenAIEmbeddings } from "@langchain/openai";
import { formatDocumentsAsString } from "langchain/util/document";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { Chroma } from "@langchain/community/vectorstores/chroma";



import pkg from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';


const { Kafka, CompressionTypes, CompressionCodecs } = pkg;


var vectorStore = null;

function getHelloWorld(req, res) {
    res.status(200).send({message: "Hello, world!"});
}

async function getVectorStore() {
    if (vectorStore == null) {
        vectorStore = await Chroma.fromExistingCollection(new OpenAIEmbeddings(), {
            collectionName: "imdb_reviews2",
            url: "http://localhost:8000", // Optional, will default to this value
            });
    } else
        console.log('Vector store already initialized');
    return vectorStore;
}

function getMesages(req, res) {
    res.status(200).send(JSON.stringify(kafka_messages));
}


// POST Message to Kafka 
async function postMessage(p,c,req, res) {
    try {
        const { post_json, attach } = req.body;
        
        if (!post_json || !post_json.username || !post_json.post_text) {
        return res.status(400).json({ 
            error: 'Required fields missing in post_json (username, source_site, post_text)' 
        });
        }

        // Generate UUID if not provided
        //const messageUUID = post_json.post_uuid_within_site || uuidv4();
        const messageUUID = uuidv4();
        
        // Construct the formatted message
        const formattedMessage = {
        post_json: {
            username: post_json.username,
            source_site: c.groupId,
            post_uuid_within_site: messageUUID,
            post_text: post_json.post_text,
            content_type: 'text/html'
        }
        };

        // Add attachment if provided
        if (attach) {
        formattedMessage.attach = attach;
        }

        await p.send({
            topic: c.federatedTopic,
            compression: CompressionTypes.Snappy,
            messages: [
                { value: JSON.stringify(formattedMessage) },
            ],
        });

        res.status(200).json({ status: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
}

/* Here we construct an object that contains a field for each route
   we've defined, so we can call the routes from app.js. */

export {
    getHelloWorld,
    getMesages,
    postMessage
};

