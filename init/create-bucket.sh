#!/bin/sh

# MinIO 서버가 준비될 때까지 대기
until $(curl --output /dev/null --silent --head --fail http://localhost:9000); do
    echo "MinIO 서버를 기다리는 중..."
    sleep 5
done

# mc alias 설정
mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD

# 버킷 생성
mc mb local/$MINIO_BUCKET_NAME || echo "버킷 생성 실패 또는 이미 존재합니다."

# 버킷 정책 설정 (예시로 public 설정)
mc policy set public local/$MINIO_BUCKET_NAME || echo "버킷 정책 설정 실패 또는 이미 설정됨."
