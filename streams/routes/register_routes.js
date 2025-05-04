import {getHelloWorld,getMesages, postMessage} from './routes.js';
import './routes.js'

function register_routes(app,kafkaProducer,config ) {
    app.get('/', getHelloWorld);
    app.get('/hello', getHelloWorld);
     // Bind the producer to the postMessage route
     app.post('/post', (req, res) => postMessage(kafkaProducer, config, req, res));
  }
  
  export default register_routes;