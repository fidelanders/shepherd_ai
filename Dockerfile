FROM node:20

RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    cmake \
    git \
    curl

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Build whisper.cpp
RUN cmake -B whisper.cpp/build whisper.cpp

RUN cmake --build whisper.cpp/build --config Release

# DEBUG: show generated binaries
RUN find whisper.cpp/build -type f

# Download model
RUN bash ./whisper.cpp/models/download-ggml-model.sh base

ENV NODE_ENV=production

EXPOSE 5000

CMD ["npm", "start"]
