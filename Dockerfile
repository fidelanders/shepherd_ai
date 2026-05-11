FROM node:20

# Install system packages
RUN apt-get update && apt-get install -y \
    ffmpeg \
    build-essential \
    cmake \
    git \
    curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Build whisper.cpp
RUN cd whisper.cpp && make

# Expose port
EXPOSE 5000

# Start app
CMD ["npm", "start"]