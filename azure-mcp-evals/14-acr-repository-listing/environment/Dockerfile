FROM ubuntu:24.04

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        curl \
        git \
        jq \
        ca-certificates \
        bash && \
    rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash agent

WORKDIR /app
