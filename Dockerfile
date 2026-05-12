# FROM node:20

# # Install system dependencies
# RUN apt-get update && apt-get install -y \
#     ffmpeg \
#     build-essential \
#     cmake \
#     git \
#     curl \
#     && rm -rf /var/lib/apt/lists/*

# # Set app directory
# WORKDIR /app

# # Copy package files
# COPY package*.json ./

# # Install Node dependencies
# RUN npm install

# # Copy project files
# COPY . .

# # Fetch whisper.cpp directly
# RUN git clone https://github.com/ggml-org/whisper.cpp.git

# WORKDIR /app/whisper.cpp

# RUN cmake -B build
# RUN cmake --build build -j$(nproc)

# RUN bash ./models/download-ggml-model.sh base

# WORKDIR /app

# # Production environment
# ENV NODE_ENV=production

# # Expose application port
# EXPOSE 5000

# # Start application
# CMD ["npm", "start"]
FROM node:20

RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    cmake \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN git clone https://github.com/ggml-org/whisper.cpp.git

WORKDIR /app/whisper.cpp

# 🔥 Performance critical change
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release
RUN cmake --build build -j$(nproc)

# Optional: smaller/faster model
RUN bash ./models/download-ggml-model.sh tiny.en

WORKDIR /app

ENV NODE_ENV=production

# optional tuning
ENV OMP_NUM_THREADS=4

EXPOSE 5000

CMD ["npm", "start"]