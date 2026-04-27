FROM ubuntu:24.04

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        curl \
        git \
        jq \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
