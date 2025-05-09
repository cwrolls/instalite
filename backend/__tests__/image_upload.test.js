jest.resetModules();

jest.mock('@vladmandic/face-api', () => {
  const mockChain = {
    withFaceLandmarks: jest.fn().mockReturnThis(),
    withFaceDescriptors: jest.fn().mockReturnValue([
      { descriptor: Float32Array.from([0.1, 0.2, 0.3]) }
    ]),
  };
  return {
    nets: {
      ssdMobilenetv1: { loadFromDisk: jest.fn().mockResolvedValue(undefined) },
      faceLandmark68Net: { loadFromDisk: jest.fn().mockResolvedValue(undefined) },
      faceRecognitionNet: { loadFromDisk: jest.fn().mockResolvedValue(undefined) },
    },
    detectAllFaces: jest.fn(() => mockChain),
    SsdMobilenetv1Options: function (options) { return options; },
    _resetMockChain: () => {
        mockChain.withFaceDescriptors.mockClear();
        mockChain.withFaceDescriptors.mockReturnValue([ { descriptor: Float32Array.from([0.1, 0.2, 0.3]) } ]);
    },
    _setFaceDescriptors: (descriptors) => {
        mockChain.withFaceDescriptors.mockReturnValue(descriptors);
    }
  };
});

const mockQuery = jest.fn().mockResolvedValue({
  ids: [['actor1']],
  distances: [[0.1]],
  metadatas: [[{ name: 'Test Actor', profile_photo: 'test.jpg' }]],
});
const mockAdd = jest.fn().mockResolvedValue(true);
const mockGetCollection = jest.fn().mockResolvedValue({
    query: mockQuery,
    add: mockAdd,
});
jest.mock("chromadb", () => {
  return {
    ChromaClient: jest.fn(() => ({
      getCollection: mockGetCollection,
    })),
    _mockGetCollection: mockGetCollection,
    _mockQuery: mockQuery,        
    _mockAdd: mockAdd,   
  };
});

const AWSMock = require('aws-sdk-mock');
const AWS = require('aws-sdk');
AWSMock.setSDKInstance(AWS);

let capturedS3Params = null;
AWSMock.mock('S3', 'upload', (params, callback) => {
  capturedS3Params = params; // Capture parameters
  const key = params.Key || 'default/key';
  const bucket = params.Bucket || 'test-bucket';
  callback(null, { Location: `s3://${bucket}/${key}` });
});


const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); 

const imageUpload = require('../routes/imageUpload');
const router = imageUpload.default;

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));


jest.setTimeout(15000);

describe('Image Upload and Matching API', () => {
  let app;
  const testImageBuffer = fs.readFileSync(path.join(__dirname, '../assets/test-face.jpg'));
  const testImageFilename = 'test-face.jpg';
  const testBucketName = 'test-bucket';

  const getFaceApiMock = () => require('@vladmandic/face-api');

  beforeEach(() => {
    jest.clearAllMocks(); 

    mockGetCollection.mockResolvedValue({ query: mockQuery, add: mockAdd });
    mockQuery.mockResolvedValue({
        ids: [['actor1']],
        distances: [[0.1]],
        metadatas: [[{ name: 'Test Actor', profile_photo: 'test.jpg' }]],
    });
     getFaceApiMock()._resetMockChain();

    capturedS3Params = null;

    process.env.S3_BUCKET_NAME = testBucketName;
    process.env.CHROMA_DB_URL = 'http://test-chroma:8000';

    app = express();
    app.use(express.json());
    router.getEmbeddingsFromBuffer = imageUpload.getEmbeddingsFromBuffer;
    app.use('/', router);
  });

  afterAll(() => {
    AWSMock.restore('S3');
    jest.resetModules();
  });


  it('should successfully upload an image and return actor matches', async () => {
    const userId = 'test-user-success-123';

    const response = await request(app)
      .post('/upload-profile-image')
      .attach('image', testImageBuffer, testImageFilename)
      .field('userId', userId);

    expect(response.status).toBe(200);
    expect(response.body.profileImageUrl).toMatch(`s3://${testBucketName}/profile-images/${userId}/`);
    expect(response.body.topActors).toHaveLength(1);
    expect(response.body.topActors[0].name).toBe('Test Actor');

    const { ChromaClient, _mockGetCollection, _mockQuery } = require('chromadb');
    expect(ChromaClient).toHaveBeenCalledTimes(1);
    expect(ChromaClient).toHaveBeenCalledWith({ path: 'http://test-chroma:8000' });
    expect(_mockGetCollection).toHaveBeenCalledWith("actor_faces");
    expect(_mockQuery).toHaveBeenCalledWith(expect.objectContaining({
        queryEmbeddings: expect.arrayContaining([
            expect.closeTo(0.1), expect.closeTo(0.2), expect.closeTo(0.3)
        ]),
        nResults: 5, include: ['metadatas']
    }));
  });

  it('should handle no file upload', async () => {
    const response = await request(app).post('/upload-profile-image');
    expect(response.status).toBe(400);
    expect(response.text).toBe('No file uploaded.');
    expect(capturedS3Params).toBeNull();
  });

  it('should handle errors during image processing', async () => {
    const userId = 'test-user-img-proc-error';
    router.getEmbeddingsFromBuffer = jest.fn().mockRejectedValueOnce(new Error('Simulated Image processing failed'));

    const response = await request(app)
      .post('/upload-profile-image')
      .attach('image', testImageBuffer, testImageFilename)
      .field('userId', userId);

    expect(response.status).toBe(500);
    expect(response.text).toBe('Error uploading image or processing.');
    expect(capturedS3Params).not.toBeNull();
    const { ChromaClient } = require('chromadb');
    expect(ChromaClient).not.toHaveBeenCalled(); 
  });

  it('should handle errors during ChromaDB query', async () => {
    const userId = 'test-user-chroma-error';
    mockQuery.mockRejectedValueOnce(new Error('Simulated ChromaDB query failed'));

    const response = await request(app)
      .post('/upload-profile-image')
      .attach('image', testImageBuffer, testImageFilename)
      .field('userId', userId);

    expect(response.status).toBe(500);
    expect(response.text).toBe('Error uploading image or processing.');
    const { ChromaClient } = require('chromadb');
    expect(ChromaClient).toHaveBeenCalledTimes(1); 
    expect(mockGetCollection).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledTimes(1); 
  });

  it('should return an empty actor list if no faces are detected', async () => {
    const userId = 'test-user-no-face';
    getFaceApiMock()._setFaceDescriptors([]);

    const response = await request(app)
      .post('/upload-profile-image')
      .attach('image', testImageBuffer, testImageFilename)
      .field('userId', userId);

    expect(response.status).toBe(200);
    expect(response.body.profileImageUrl).toMatch(`s3://${testBucketName}/profile-images/${userId}/`);
    expect(response.body.topActors).toEqual([]);
    const { ChromaClient } = require('chromadb');
    expect(ChromaClient).not.toHaveBeenCalled(); 
  });


  it('should set correct parameters for S3 upload', async () => {
    const userId = 'test-user-s3-params';
    const mockUuid = 'mock-uuid-12345';
    require('uuid').v4.mockReturnValue(mockUuid); 

    await request(app)
      .post('/upload-profile-image')
      .attach('image', testImageBuffer, testImageFilename)
      .field('userId', userId);

    expect(capturedS3Params).not.toBeNull();
    expect(capturedS3Params.Bucket).toBe(testBucketName);
    expect(capturedS3Params.Key).toBe(`profile-images/${userId}/${mockUuid}-${testImageFilename}`);
    expect(capturedS3Params.Body).toBeInstanceOf(Buffer);
    expect(capturedS3Params.ContentType).toBe('image/jpeg'); 
    expect(capturedS3Params.ACL).toBe('public-read');
  });

  it('should use default user ID "test-user" if none provided', async () => {
    const mockUuid = 'mock-uuid-67890';
    require('uuid').v4.mockReturnValue(mockUuid);

    const response = await request(app)
      .post('/upload-profile-image')
      .attach('image', testImageBuffer, testImageFilename); 

    expect(response.status).toBe(200);
    expect(capturedS3Params).not.toBeNull();
    expect(capturedS3Params.Key).toBe(`profile-images/test-user/${mockUuid}-${testImageFilename}`); 
    expect(response.body.profileImageUrl).toMatch(`s3://${testBucketName}/profile-images/test-user/`);
  });

  it('should handle fewer than K results from ChromaDB gracefully', async () => {
    const userId = 'test-user-few-results';
    mockQuery.mockResolvedValueOnce({
        ids: [['actor2', 'actor3']],
        distances: [[0.2, 0.3]],
        metadatas: [[{ name: 'Actor Two', profile_photo: 'two.jpg' }, { name: 'Actor Three', profile_photo: 'three.jpg' }]],
    });

    const response = await request(app)
      .post('/upload-profile-image')
      .attach('image', testImageBuffer, testImageFilename)
      .field('userId', userId);

    expect(response.status).toBe(200);
    expect(response.body.topActors).toHaveLength(2);
    expect(response.body.topActors[0].name).toBe('Actor Two');
    expect(response.body.topActors[1].name).toBe('Actor Three');
  });


  it('should handle missing fields in ChromaDB metadata', async () => {
    const userId = 'test-user-missing-meta';
    mockQuery.mockResolvedValueOnce({
        ids: [['actor4', 'actor5', 'actor6']],
        distances: [[0.4, 0.5, 0.6]], 
        metadatas: [ 
           [
             { profile_photo: 'four.jpg' },
             { name: 'Actor Five' },
             null
           ]
        ],
    });


    const response = await request(app)
      .post('/upload-profile-image')
      .attach('image', testImageBuffer, testImageFilename)
      .field('userId', userId);

    expect(response.status).toBe(200);
    expect(response.body.topActors).toHaveLength(3);
    expect(response.body.topActors[0].name).toBe('Unknown');
    expect(response.body.topActors[0].profilePhotoUrl).toBe('four.jpg');
    expect(response.body.topActors[1].name).toBe('Actor Five'); 
    expect(response.body.topActors[1].profilePhotoUrl).toBe('default.jpg');
    expect(response.body.topActors[2].name).toBe('Unknown');
    expect(response.body.topActors[2].profilePhotoUrl).toBe('default.jpg');
  });

 it('should handle empty or invalid results from ChromaDB query', async () => {
    const userId = 'test-user-empty-chroma';
    mockQuery.mockResolvedValueOnce(null);

    let response = await request(app)
      .post('/upload-profile-image')
      .attach('image', testImageBuffer, testImageFilename)
      .field('userId', userId + '-null');

    expect(response.status).toBe(200);
    expect(response.body.topActors).toEqual([]);

    mockQuery.mockResolvedValueOnce({});
     response = await request(app)
      .post('/upload-profile-image')
      .attach('image', testImageBuffer, testImageFilename)
      .field('userId', userId + '-emptyobj');

    expect(response.status).toBe(200);
    expect(response.body.topActors).toEqual([]);


    mockQuery.mockResolvedValueOnce({ ids: null, metadatas: null });
     response = await request(app)
      .post('/upload-profile-image')
      .attach('image', testImageBuffer, testImageFilename)
      .field('userId', userId + '-nullarrays');

    expect(response.status).toBe(200);
    expect(response.body.topActors).toEqual([]);
  });

});