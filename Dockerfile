FROM node:20

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    cmake \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for Docker layer caching
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy application source
COPY . .

# Build whisper.cpp
RUN cmake -B /app/whisper.cpp/build \
    -DCMAKE_BUILD_TYPE=Release \
    /app/whisper.cpp

RUN cmake --build /app/whisper.cpp/build --config Release -j

# Debug compiled binaries (visible in Render logs)
RUN ls -R /app/whisper.cpp/build/bin

# Download Whisper model
RUN bash /app/whisper.cpp/models/download-ggml-model.sh base

# Set environment variables
ENV NODE_ENV=production

# IMPORTANT:
# Change this to whisper-cli if your logs show whisper-cli instead of main
ENV WHISPER_BIN=/app/whisper.cpp/build/bin/main

# Expose application port
EXPOSE 5000

# Start app
CMD ["npm", "start"]