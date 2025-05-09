
var path = require('path');
const { ChromaClient } = require("chromadb");
const fs = require('fs');
const tf = require('@tensorflow/tfjs-node');
const faceapi = require('@vladmandic/face-api');


let optionsSSDMobileNet;


const getArray = (array) => {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    ret.push(array[i]);
  }
  return ret;
}


async function getEmbeddings(imageFile) {
  const buffer = fs.readFileSync(imageFile);
  const tensor = tf.node.decodeImage(buffer, 3);

  const faces = await faceapi.detectAllFaces(tensor, optionsSSDMobileNet)
    .withFaceLandmarks()
    .withFaceDescriptors();
  tf.dispose(tensor);

  return faces.map((face) => getArray(face.descriptor));
};

async function initializeFaceModels() {
  console.log("Initializing FaceAPI...");

  await tf.ready();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk('model');
  optionsSSDMobileNet = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 1 });
  await faceapi.nets.faceLandmark68Net.loadFromDisk('model');
  await faceapi.nets.faceRecognitionNet.loadFromDisk('model');

  return;
}

async function indexAllFaces(pathName, image, collection) {
  const embeddings = await getEmbeddings(pathName);

  var success = true;
  var inx = 1;
  for (var embedding of embeddings) {
    const data = {
      ids: [image + '-' + inx++],
      embeddings: [
        embedding,
      ],
      metadatas: [{ source: "imdb" } ],
      documents: [ image ],
    };
    
    var res = await collection.add(data);
    

    if (res === true) {
      console.info("Added image embedding for " + image + " to collection.");
    } else {
      success = false;
    }
  }
  return success;
}

async function findTopKMatches(collection, image, k) {
  var ret = [];

  var queryEmbeddings = await getEmbeddings(image);
  for (var queryEmbedding of queryEmbeddings) {
    var results = await collection.query({
      queryEmbeddings: queryEmbedding,
      nResults: k
    });

    ret.push(results);
  }
  return ret;
}

async function compareImages(file1, file2) {
  console.log('Comparing images:', file1, file2);

  const desc1 = await getEmbeddings(file1);
  const desc2 = await getEmbeddings(file2);

  const distance = faceapi.euclideanDistance(desc1[0], desc2[0]); 
  console.log('L2 distance between most prominent detected faces:', distance); 
  console.log('Similarity between most prominent detected faces:', 1 - distance); 
};


const client = new ChromaClient({ path: "http://44.223.91.5:8000" });
initializeFaceModels()
.then(async () => {

  const collection = await client.getOrCreateCollection({
    name: "face-api",
    embeddingFunction: null,
    metadata: { "hnsw:space": "l2" },
  });

  console.info("Looking for files");
  const promises = [];
  const search = 'images/nm0949403.jpg';
  
  console.log('\nTop-k indexed matches to ' + search + ':');
  for (var item of await findTopKMatches(collection, search, 5)) {
    for (var i = 0; i < item.ids[0].length; i++) {
      console.log(item.ids[0][i] + " (Euclidean distance = " + Math.sqrt(item.distances[0][i]) + ") in " + item.documents[0][i]);
    }
  }

});

