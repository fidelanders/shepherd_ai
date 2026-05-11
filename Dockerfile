FROM node:20

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    cmake \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set app directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy all project files
COPY . .

# Build whisper.cpp using CMake
RUN cmake -B whisper.cpp/build whisper.cpp
RUN cmake --build whisper.cpp/build --config Release

# Download Whisper model
RUN bash ./whisper.cpp/models/download-ggml-model.sh base

# Debug: show compiled binaries
RUN find whisper.cpp/build -type f

# Set production environment
ENV NODE_ENV=production

# Expose app port
EXPOSE 5000

# Start application
CMD ["npm", "start"]