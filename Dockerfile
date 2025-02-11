FROM oven/bun:latest
WORKDIR /app

RUN apt update && apt install -y wget xz-utils && rm -rf /var/lib/apt/lists/*

RUN wget -q https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-n7.1-latest-linux64-gpl-7.1.tar.xz && \
    tar -xvf ffmpeg-n7.1-latest-linux64-gpl-7.1.tar.xz && \
    mv ffmpeg-n7.1-latest-linux64-gpl-7.1/bin/ffmpeg /usr/local/bin/ffmpeg && \
    mv ffmpeg-n7.1-latest-linux64-gpl-7.1/bin/ffprobe /usr/local/bin/ffprobe && \
    rm -rf ffmpeg-n7.1-latest-linux64-gpl-7.1 && \
    rm ffmpeg-n7.1-latest-linux64-gpl-7.1.tar.xz

WORKDIR /app/server
COPY server/package.json server/bun.lockb ./
RUN bun install --frozen-lockfile
WORKDIR /app

COPY . .

RUN mkdir -p ./server/src/static && \
    cd client && \
    bun install && \
    bun run build && \
    cp -R ./dist/* ../server/src/static/ && \
    rm -rf node_modules

WORKDIR /app/server
EXPOSE 3000
CMD ["bun", "start:api"]