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

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install

# Copy project files
COPY . .

# Clean old whisper.cpp build artifacts
RUN rm -rf whisper.cpp/build

# Remove any problematic CMake cache files
RUN find whisper.cpp -name "CMakeCache.txt" -type f -delete

# Remove stale CMake generated folders
RUN find whisper.cpp -name "CMakeFiles" -type d -exec rm -rf {} +

# Configure whisper.cpp build
RUN cmake -S whisper.cpp -B whisper.cpp/build

# Build whisper.cpp
RUN cmake --build whisper.cpp/build --config Release

# Debug generated binaries
RUN echo "=== BUILT BINARIES ===" && \
    find whisper.cpp/build -type f | grep -E "whisper|main"

# Download Whisper model
RUN bash ./whisper.cpp/models/download-ggml-model.sh base

# Production environment
ENV NODE_ENV=production

# Expose application port
EXPOSE 5000

# Start application
CMD ["npm", "start"]
