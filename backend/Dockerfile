
FROM node:22-bookworm-slim
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python python /usr/bin/python3 1
COPY package*.json ./
ENV TFJS_NODE_SKIP_PREBUILT_BINARY=true
RUN NPM_CONFIG_LOGLEVEL=verbose npm install --production --build-from-source=@tensorflow/tfjs-node
COPY . .
RUN echo "Checking for tfjs_binding.node..." && \
    ls -l /usr/src/app/node_modules/@tensorflow/tfjs-node/lib/napi-v*/ || echo "tfjs_binding.node not found in expected napi directory" && \
    ls -l /usr/src/app/node_modules/@tensorflow/tfjs-node/prebuilds/linux-*/ || echo "tfjs_binding.node not found in prebuilds directory" && \
    find /usr/src/app/node_modules/@tensorflow/tfjs-node/ -name "*.node" || echo "No .node files found in @tensorflow/tfjs-node"
EXPOSE 3000
ENV PORT=3000
CMD [ "node", "server.js" ]