#!/bin/sh

# mc alias 설정
mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD

# 버킷 생성
mc mb local/$MINIO_BUCKET_NAME || echo "버킷 생성 실패 또는 이미 존재합니다."

# 버킷 공개 설정
mc anonymous set public local/$MINIO_BUCKET_NAME