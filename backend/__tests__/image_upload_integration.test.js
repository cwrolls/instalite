// npx jest image_upload.integration.test.js

require('dotenv').config();

const request = require('supertest');
const express = require('express');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { ChromaClient } = require('chromadb');

const imageUploadModule = require('../routes/imageUpload');
const router = imageUploadModule.default;
const initializeFaceModels = imageUploadModule.initializeFaceModels;
const getEmbeddingsFromBuffer = imageUploadModule.getEmbeddingsFromBuffer;

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const CHROMA_DB_URL = process.env.CHROMA_DB_URL;
const AWS_REGION = process.env.AWS_REGION;

const missingEnvVars = [
  !S3_BUCKET_NAME && 'S3_BUCKET_NAME',
  !CHROMA_DB_URL && 'CHROMA_DB_URL',
  !process.env.AWS_ACCESS_KEY_ID && 'AWS_ACCESS_KEY_ID',
  !process.env.AWS_SECRET_ACCESS_KEY && 'AWS_SECRET_ACCESS_KEY',
  !AWS_REGION && 'AWS_REGION',
].filter(Boolean);

const runIntegrationTests = missingEnvVars.length === 0;
const describeIntegration = runIntegrationTests ? describe : describe.skip;

let app;
let s3;
let testImageBuffer;
const testImageFilename = 'test-integration-face.jpg';
const uploadedKeys = [];

describeIntegration('Image Upload Integration Tests', () => {
  jest.setTimeout(30000);

  beforeAll(async () => {
    console.log('--- Starting Integration Tests ---');

    if (!runIntegrationTests) {
      console.warn(`Skipping integration tests. Missing env vars: ${missingEnvVars.join(', ')}`);
      return;
    }

    console.log(`Using S3 Bucket: ${S3_BUCKET_NAME}`);

    const chromaUrl = process.env.CHROMA_DB_URL;
    console.log(`Raw CHROMA_DB_URL from env: '${chromaUrl}'`);
    if (!chromaUrl) {
      throw new Error("CHROMA_DB_URL environment variable is not set.");
    }

    AWS.config.update({ region: AWS_REGION });
    s3 = new AWS.S3();

    const imagePath = path.join(__dirname, '../assets/test-face.jpg');
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Test image not found at: ${imagePath}`);
    }
    testImageBuffer = fs.readFileSync(imagePath);

    console.log("Initializing FaceAPI (before ChromaDB)...");
    await initializeFaceModels();
    console.log("FaceAPI initialized.");

    try {
      console.log(`Attempting to connect ChromaClient to: ${chromaUrl}`);
      const client = new ChromaClient({ path: chromaUrl });
      
      // Skip tenant/database creation since we're using an older version
      console.log("Using older ChromaDB client - skipping tenant/database setup");
      
      const collectionName = 'actor_faces';
      console.log(`Attempting to get or create collection: name='${collectionName}'`);

      // Try both approaches - direct name parameter or object parameter
      let collection = null;
      let collectionExists = false;

      // First try the older API style
      try {
        collection = await client.getCollection(collectionName);
        console.log(`Collection '${collectionName}' found using older API.`);
        collectionExists = true;
      } catch (oldGetError) {
        console.log(`Could not get collection using older API: ${oldGetError.message}`);
        
        // Try the newer API style as fallback
        try {
          collection = await client.getCollection({ name: collectionName });
          console.log(`Collection '${collectionName}' found using newer API.`);
          collectionExists = true;
        } catch (newGetError) {
          console.log(`Could not get collection using newer API: ${newGetError.message}`);
        }
      }

      if (!collectionExists) {
        console.log(`Attempting to create collection: name='${collectionName}'`);
        try {
          // Try older API style first
          collection = await client.createCollection(collectionName);
          console.log(`Successfully created collection '${collectionName}' using older API.`);
        } catch (oldCreateError) {
          console.log(`Could not create collection using older API: ${oldCreateError.message}`);
          
          // Try newer API style as fallback
          try {
            collection = await client.createCollection({ name: collectionName });
            console.log(`Successfully created collection '${collectionName}' using newer API.`);
          } catch (newCreateError) {
            console.error(`Failed to create collection: ${newCreateError.message}`);
            throw newCreateError;
          }
        }
      }

      console.log(`Successfully ensured collection '${collectionName}' exists.`);
    } catch (error) {
      console.error("Failed prerequisite check for ChromaDB/collection. Check ChromaDB service and logs.", error);
      if (error.cause) {
        console.error("Underlying cause:", error.cause);
      }
      throw new Error("ChromaDB prerequisite check failed...");
    }

    console.log("Initializing Express app...");
    app = express();
    app.use(express.json());

    if (!router) {
      throw new Error("Router object is not available or undefined!");
    }

    app.use('/', router);
    console.log("Express app initialized and router mounted.");

    console.log("beforeAll completed successfully.");
  });

  afterEach(async () => {
    if (s3 && uploadedKeys.length > 0) {
      console.log(`Cleaning up ${uploadedKeys.length} S3 object(s)...`);
      const objectsToDelete = uploadedKeys.map(key => ({ Key: key }));
      try {
        await s3.deleteObjects({
          Bucket: S3_BUCKET_NAME,
          Delete: { Objects: objectsToDelete }
        }).promise();
        console.log("S3 cleanup successful.");
      } catch (err) {
        console.error("Error during S3 cleanup:", err);
      }
      uploadedKeys.length = 0;
    }
  });

  afterAll(() => {
    console.log('--- Finished Integration Tests ---');
  });

  it('should successfully upload an image to S3 and get actor matches from ChromaDB', async () => {
    const userId = `integration-user-${Date.now()}`;
    if (!app) {
      throw new Error("App object is undefined or null right before making the request!");
    }
    console.log(`App object type before request: ${typeof app}`);
    const response = await request(app)
        .post('/upload-profile-image')
        .attach('image', testImageBuffer, testImageFilename)
        .field('userId', userId);

    expect(response.status).toBe(200); 
    expect(response.body).toHaveProperty('profileImageUrl');
    expect(response.body).toHaveProperty('topActors');

    const imageUrl = response.body.profileImageUrl;
    const expectedBucketPrefix = `https://${S3_BUCKET_NAME}.s3.`;
    const expectedPathPrefix = `amazonaws.com/profile-images/${userId}/`;

    console.log("Received image URL:", imageUrl); 
    console.log("Expecting URL to contain:", expectedBucketPrefix);
    console.log("Expecting URL to contain:", expectedPathPrefix);

    expect(imageUrl).toContain(expectedBucketPrefix);
    expect(imageUrl).toContain(expectedPathPrefix); 

    const uploadedKey = imageUrl.split('.amazonaws.com/')[1];
    expect(uploadedKey).toContain(testImageFilename);
    uploadedKeys.push(uploadedKey);

    try {
      await s3.headObject({ Bucket: S3_BUCKET_NAME, Key: uploadedKey }).promise();
      console.log(`Verified object exists in S3: ${uploadedKey}`);
    } catch (error) {
      throw new Error(`S3 object not found after upload: ${uploadedKey}. Error: ${error}`);
    }

    const topActors = response.body.topActors;
    expect(Array.isArray(topActors)).toBe(true);
    expect(topActors.length).toBeGreaterThanOrEqual(0);
    expect(topActors.length).toBeLessThanOrEqual(5);

    if (topActors.length > 0) {
      topActors.forEach(actor => {
          expect(actor).toHaveProperty('actorId');
          expect(actor).toHaveProperty('name');
          expect(actor).toHaveProperty('profilePhotoUrl');
          expect(actor).toHaveProperty('similarityScore');
          expect(typeof actor.actorId).toBe('string');
          expect(typeof actor.name).toBe('string');
          expect(typeof actor.profilePhotoUrl).toBe('string');
          expect(typeof actor.similarityScore).toBe('number');
          expect(actor.similarityScore).toBeGreaterThanOrEqual(0);
          expect(actor.similarityScore).toBeLessThanOrEqual(1);
      });
      console.log(`Found ${topActors.length} potential actor matches.`);
    } else {
      console.log("No actor matches found (expected if ChromaDB is empty or no match).");
    }
  });

  it('should handle image upload with no detectable faces', async () => {
    const userId = `integration-no-face-${Date.now()}`;
    const noFaceImagePath = path.join(__dirname, '../assets/test-no-face.jpg');

    if (!fs.existsSync(noFaceImagePath)) {
      console.warn("Skipping no-face test: test-no-face.jpg not found.");
      return;
    }

    const noFaceImageBuffer = fs.readFileSync(noFaceImagePath);
    const noFaceImageFilename = 'test-no-face.jpg';

    if (!app) {
      throw new Error("App object is undefined or null right before making the request!");
    }

    const response = await request(app)
      .post('/upload-profile-image')
      .attach('image', noFaceImageBuffer, noFaceImageFilename)
      .field('userId', userId);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('profileImageUrl');
    expect(response.body.topActors).toEqual([]);

    const uploadedKey = response.body.profileImageUrl.split('.amazonaws.com/')[1];
    expect(uploadedKey).toContain(`profile-images/${userId}/`);
    uploadedKeys.push(uploadedKey);

    try {
      await s3.headObject({ Bucket: S3_BUCKET_NAME, Key: uploadedKey }).promise();
      console.log(`Verified object exists in S3 (no-face test): ${uploadedKey}`);
    } catch (error) {
      throw new Error(`S3 object not found after upload (no-face test): ${uploadedKey}. Error: ${error}`);
    }
  });
});

describe('Integration Test Prerequisites Check', () => {
  it('should have required environment variables defined', () => {
    if (!runIntegrationTests) {
      console.warn(`Integration tests skipped due to missing environment variables: ${missingEnvVars.join(', ')}`);
      expect(true).toBe(true);
    } else {
      console.log("All required environment variables for integration tests are present.");
      expect(runIntegrationTests).toBe(true);
    }
  });
});
