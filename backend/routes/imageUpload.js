const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk'); 
const { v4: uuidv4 } = require('uuid');
const { ChromaClient } = require("chromadb");
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');
const multer = require('multer');
const db = require('../db');
const { isAuthenticated } = require('./middleware/authMiddleware');
const fs = require('fs');

const BUCKET_NAME = process.env.S3_BUCKET_NAME;
if (!BUCKET_NAME) console.warn("!!! S3_BUCKET_NAME environment variable not set.");

const s3 = new AWS.S3();


const CHROMA_DB_URL = process.env.CHROMA_DB_URL || "http://localhost:8000";
const chromaClient = new ChromaClient({ path: CHROMA_DB_URL });

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// actor name map
let actorNameMap = {};
const LOCAL_NAMES_CSV_PATH = path.join(__dirname, 'names.csv');

function loadLocalActorNames() {
    console.log(`Attempting to load local actor names from: ${LOCAL_NAMES_CSV_PATH}`);
    try {
        if (!fs.existsSync(LOCAL_NAMES_CSV_PATH)) {
            console.error(`!!! Local actor names CSV file not found at ${LOCAL_NAMES_CSV_PATH}. Actor names will be 'Unknown'. Check path.`);
            return;
        }
        const fileContent = fs.readFileSync(LOCAL_NAMES_CSV_PATH, 'utf8');
        const lines = fileContent.trim().split('\n');
        let count = 0;
        let parseErrors = 0;

        console.log(`Parsing local CSV. Total lines: ${lines.length}`);
        for (let i = 0; i < lines.length; i++) {
             const line = lines[i];
             if (!line) continue;
             const parts = line.split(','); 

             if (parts.length >= 4) {
                 const name = parts[0]?.replace(/^"|"$/g, '').trim();
                 const nconst = parts[3]?.trim();
                 if (nconst?.startsWith('nm') && name) {
                     actorNameMap[nconst] = { name, nconst };
                     count++;
                 } else { parseErrors++; }
             } else { parseErrors++; }
        }
        console.log(`Finished parsing local CSV. Successfully loaded info for ${count} actors into map.`);
        if (parseErrors > 0) console.warn(`Encountered ${parseErrors} lines with parsing issues in local CSV.`);
    } catch (error) {
        console.error(`!!! Failed to load or parse local actor names CSV:`, error);
    }
}

// faceapi init
let faceDetectionOptions;
let faceApiInitialized = false;
async function initializeFaceModels() {
    if (faceApiInitialized) return;
    console.log("Initializing FaceAPI models...");
    try {
        await tf.ready();
        console.log(`Using TensorFlow backend: ${tf.getBackend()}`);
        const modelPath = path.join(__dirname, '..', 'models'); 
        console.log(`Loading models from: ${modelPath}`);
        if (!fs.existsSync(modelPath)) throw new Error(`Model directory not found: ${modelPath}`);
        if (!fs.existsSync(path.join(modelPath, 'ssd_mobilenetv1_model-weights_manifest.json'))) {
            throw new Error(`ssdMobilenetv1 model files not found in ${modelPath}. Ensure models are downloaded and placed correctly.`);
        }
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
        await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
        await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
        faceDetectionOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 1 });
        faceApiInitialized = true;
        console.log("FaceAPI models initialized successfully.");
    } catch (error) {
        console.error("!!! ERROR initializing FaceAPI models:", error);
    }
}
const descriptorToArray = (descriptor) => {
    if (!descriptor) return [];
    return Array.from(descriptor);
};


// helper
async function getEmbeddingsFromBuffer(buffer) {
    if (!faceApiInitialized) { throw new Error("Face detection service not ready."); }
    let tensor;
    try {
        tensor = tf.node.decodeImage(buffer, 3);
        if (!tensor) throw new Error("Failed to decode image buffer into tensor.");
        const faces = await faceapi
            .detectAllFaces(tensor, faceDetectionOptions)
            .withFaceLandmarks()
            .withFaceDescriptors();
        tf.dispose(tensor);
        if (faces.length === 0 || !faces[0].descriptor) {
            console.warn(`getEmbeddingsFromBuffer: No faces detected OR descriptor computation failed for the uploaded image.`);
            return [];
        }
        return descriptorToArray(faces[0].descriptor);
    } catch (error) {
        console.error("getEmbeddingsFromBuffer: Error during face detection/embedding:", error);
        if (tensor) tf.dispose(tensor);
        throw error; 
    }
}

async function findTopKMatches(queryEmbedding, k = 5) {
    if (!queryEmbedding || queryEmbedding.length === 0) return [];
    try {
        const collection = await chromaClient.getCollection({ name: "face-api" }); 
        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: k,
            include: ['metadatas', 'distances']
        });

        if (results && results.ids && results.ids[0] && results.ids[0].length > 0) {
            return results.ids[0].map((id, index) => ({
                actorId: id,
                distance: results.distances?.[0]?.[index] ?? null,
                metadata: results.metadatas?.[0]?.[index] || {}
            }));
        }
        return [];
    } catch (error) {
        console.error(`Error querying ChromaDB collection 'face-api':`, error);
        if (error.message?.includes('does not exist')) {
             console.error(`!!! Collection 'face-api' not found. Ensure population script ran correctly and collection name matches.`);
             return [];
        }
        throw error;
    }
}

// POST /api/images/upload-profile-image
router.post('/upload-profile-image', isAuthenticated, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded.' });
    if (!BUCKET_NAME) return res.status(500).json({ error: 'Server configuration error: S3 bucket name not set.' });

    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    const userId = req.session.user.userId;
    const username = req.session.user.username;
    console.log(`User ${username} (ID: ${userId}) uploading profile image.`);

    const fileBuffer = req.file.buffer;
    const originalFileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const uniqueFileName = `${uuidv4()}${path.extname(originalFileName) || '.jpg'}`;
    const s3Key = `profile-images/${userId}/${uniqueFileName}`;

    let profileImageUrl = null;
    let topActors = [];
    let candidate_ncosts_string = "";

    try {
        try {
            console.log(`Uploading profile image to S3: Bucket=${BUCKET_NAME}, Key=${s3Key}`);
            const s3UploadParams = {
                Bucket: BUCKET_NAME,
                Key: s3Key,
                Body: fileBuffer,
                ContentType: fileType,
            };
            const s3UploadResult = await s3.upload(s3UploadParams).promise();
            console.log(`Successfully uploaded to S3. Location: ${s3UploadResult.Location}`);
    
            const signedUrlParams = { Bucket: BUCKET_NAME, Key: s3Key, Expires: 3 * 24 * 60 * 60 };
            profileImageUrl = await s3.getSignedUrlPromise('getObject', signedUrlParams);
            console.log(`Generated signed URL for user ${userId}: ${profileImageUrl}`);
    
        } catch (s3Error) {
            console.error(`Error during S3 operation for user ${userId}:`, s3Error);
            return res.status(500).json({ error: 'Failed to upload image to storage.' });
        }

        // generate embeddings, find matches
        if (faceApiInitialized) {
            console.log(`Generating embeddings for user ${userId}'s image...`);
            const embedding = await getEmbeddingsFromBuffer(fileBuffer);

            if (embedding && embedding.length > 0) {
                console.log(`Embedding generated. Querying ChromaDB for similar actors...`);
                const topMatches = await findTopKMatches(embedding, 5);

                candidate_ncosts_string = topMatches.map(match => match.actorId).join(',');

                topActors = topMatches.map(match => {
                    const similarity = match.distance !== null ? Math.max(0, 1 - match.distance / 2) : null;
                    const nconstFromId = match.actorId ? match.actorId.split('-')[0].replace('.jpg', '') : null;
                    const actorInfoFromMap = nconstFromId ? actorNameMap[nconstFromId] : null;
                    const name = actorInfoFromMap?.name || 'Unknown Actor';
                    
                    const actorPhotoUrl = nconstFromId ? `/actor-images/${nconstFromId}` : null; 

                    return {
                        actorId: match.actorId,
                        name: name,
                        profilePhotoUrl: actorPhotoUrl, 
                        similarityScore: similarity,
                        nconst: nconstFromId 
                    };
                }).sort((a, b) => (b.similarityScore ?? -1) - (a.similarityScore ?? -1));
                console.log(`Found and processed ${topActors.length} actor matches.`);
            } else {
                console.log(`No embedding generated for user ${userId}'s image. Skipping ChromaDB query.`);
                candidate_ncosts_string = "";
            }
        } else {
            console.warn("FaceAPI not initialized, skipping actor matching for user " + userId);
        }
        // update user record in rds
        try {
            const updateSql = 'UPDATE users SET profile_photo_url = ?, candidate_actor_ids = ? WHERE user_id = ?';
            const [updateResult] = await db.query(updateSql, [profileImageUrl, candidate_ncosts_string, userId]);

            if (updateResult.affectedRows > 0) {
                 console.log(`Updated profile_photo_url and candidate_actor_ids in DB for user ${userId}`);
                 if (req.session.user) {
                      req.session.user.profilePhotoUrl = profileImageUrl; 
                      req.session.user.candidateActorIds = candidate_ncosts_string;
                      req.session.save(err => {
                          if (err) console.error("Error saving session after profile update:", err);
                          else console.log("Session updated successfully with new profile info.");
                      });
                 }
            } else {
                 console.warn(`DB update for profile photo/candidates for user ${userId} affected 0 rows.`);
            }
        } catch (dbError) {
            console.error(`Database error updating profile info for user ${userId}:`, dbError);
        }

    } catch (error) {
        console.error(`Error processing profile image upload for user ${userId}:`, error);
        if (!res.headersSent) {
            return res.status(500).json({ error: error.message || 'Failed to process profile image upload.' });
        }
        return; 
    }
    if (!res.headersSent) {
         res.json({
            message: "Profile image uploaded and processed.",
            profileImageUrl: profileImageUrl, 
            topActors: topActors 
        });
    }
});

// POST /api/users/link-actor
router.post('/link-actor', isAuthenticated, async (req, res) => {

    const { selectedActorId, selectedActorName } = req.body; 
    const userId = req.session.user.userId;
    const username = req.session.user.username;

    if (!selectedActorId) {
        return res.status(400).json({ error: "No actor ID provided for linking." });
    }

    try {
        const updateSql = 'UPDATE users SET linked_actor_id = ? WHERE user_id = ?';
        const [result] = await db.query(updateSql, [selectedActorId, userId]);

        if (result.affectedRows > 0) {
            if (req.session.user) {
                req.session.user.linkedActorId = selectedActorId;
                req.session.save();
            }
            console.log(`User ${userId} successfully linked to actor ${selectedActorName}`);

            const postText = `${username} is now linked to actor ${selectedActorName}.`;
            const newPostUUID = uuidv4();

            const insertPostSql = `
            INSERT INTO posts (user_id, post_text, timestamp, post_uuid_within_site)
            VALUES (?, ?, NOW(), ?)
            `;
            const [postResult] = await db.query(insertPostSql, [userId, postText, newPostUUID]);
            const newPostId = postResult.insertId;
            console.log(`Created status post ${newPostId} (UUID: ${newPostUUID}) for user ${userId} linking event (Actor ID: ${selectedActorId}).`);

            return res.json({ message: `Successfully linked to actor.` });
        } else {
            console.warn(`Failed to link user ${userId} to actor ${selectedActorId} - user not found or ID already set.`);
            return res.status(404).json({ error: "User not found or link failed." });
        }
    } catch (error) {
        console.error(`Error linking actor for user ${userId}:`, error);
        return res.status(500).json({ error: "Server error while linking actor." });
    }
});

// POST /api/users/unlink-actor
router.post('/unlink-actor', isAuthenticated, async (req, res) => {
    const userId = req.session.user.userId;

    try {
        const updateSql = 'UPDATE users SET linked_actor_id = NULL WHERE user_id = ?';
        const [result] = await db.query(updateSql, [userId]);

        if (result.affectedRows > 0) {
            if (req.session.user) {
                req.session.user.linkedActorId = null;
                req.session.save();
            }
            console.log(`User ${userId} successfully unlinked from actor.`);
            return res.json({ message: "Successfully unlinked actor." });
        } else {
            console.warn(`Attempt to unlink actor for user ${userId} affected 0 rows.`);
            return res.json({ message: "Actor was not linked or already unlinked." });
        }
    } catch (error) {
        console.error(`Error unlinking actor for user ${userId}:`, error);
        return res.status(500).json({ error: "Server error while unlinking actor." });
    }
});


router.post('/get-actor-info', async (req, res) => {
    const { nconsts } = req.body; 

    if (!Array.isArray(nconsts) || nconsts.length === 0) {
        return res.status(400).json({ error: "Invalid or empty 'nconsts' array." });
    }

    const actorInfoResults = nconsts.map(nconst => {
        const cleanNconst = nconst.replace('.jpg','').split("-")[0];
        const info = actorNameMap[cleanNconst];
        const name = info?.name || "Unknown Actor";
        const profilePhotoUrl = `/actor-images/${cleanNconst}`; 
        return { nconst: cleanNconst, name, profilePhotoUrl };
    }).filter(Boolean); 

    return res.json(actorInfoResults);
});


loadLocalActorNames();
initializeFaceModels()
    .then(() => console.log("Async backend initialization tasks complete."))
    .catch(error => console.error("!!! Async backend initialization failed:", error));


module.exports = router;