FROM node:20

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    cmake \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# App directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build whisper.cpp
RUN cmake -B whisper.cpp/build whisper.cpp

RUN cmake --build whisper.cpp/build --config Release

# Show generated binaries (debugging)
RUN find whisper.cpp/build -type f

# Download Whisper model
RUN bash ./whisper.cpp/models/download-ggml-model.sh base

# Production mode
ENV NODE_ENV=production

# Expose app port
EXPOSE 5000

# Start app
CMD ["npm", "start"]
