# Geth 사설 네트워크 노드 정보 및 MetaMask 연동 가이드

## ✅ 개요
이 문서는 Gachon-Blockchain-6 프로젝트의 Geth 기반 사설 네트워크에서 사용되는 각 노드의 계정 정보와 RPC 접속 방법, MetaMask 연동 절차를 안내합니다.

---

## 🔗 공통 정보

- **Chain ID**: `1004`
- **Network ID**: `1004`
- **Genesis**: jenesis.json
- **비밀번호 규칙**: `GCnode1`, `GCnode2`, `GCnode3` (각 노드별)

---

## 🧩 각 노드 정보

| 노드 | 계정 주소 | 비밀번호 | RPC URL (HTTP) | P2P 포트 | HTTP 포트 |
|------|--------------------------|------------|---------------------------|-----------|------------|
| node1 | `0xc956e6d9cad060f400cab7b6efa7a2efd85f925a` | `GCnode1` | `http://localhost:8545` | `30303` | `8545` |
| node2 | `0xabde9016be3309abf90e04cbeab3148b099db708` | `GCnode2` | `http://localhost:8546` | `30304` | `8546` |
| node3 | `0x5f0f91c0276361c63b8b15c50a0f48df1537dc1d` | `GCnode3` | `http://localhost:8547` | `30305` | `8547` |

---

## 🦊 MetaMask 연동 가이드

### 1. MetaMask 지갑 가져오기
1. MetaMask 열기 → **계정 가져오기**
2. **Keystore JSON 파일 선택** → `keystore/` 디렉토리 안의 `UTC--`로 시작하는 파일 선택
3. 해당 노드의 비밀번호 입력 (예: `GCnode1`)
4. 성공적으로 가져오면 계정이 추가됨

> ⚠️ Keystore 파일은 각 노드의 `./geth-network/nodeX/keystore/` 폴더에서 확인 가능

### 2. 커스텀 RPC 네트워크 등록
MetaMask → 네트워크 추가 → 수동 입력:

| 항목 | 값 |
|------|----|
| 네트워크 이름 | Gachon PrivateNet |
| RPC URL | `http://localhost:8545` (또는 node2/3에 맞춰 `:8546`, `:8547`) |
| 체인 ID | `1004` |
| 통화 기호 | ETH |
| 블록 탐색기 URL | (비워둬도 됨) |

---

## ✅ 사용 목적

- 스마트 컨트랙트 배포 및 호출을 위한 테스트 지갑
- 사용자 회원가입 시 SC에 지갑 주소 등록
- MetaMask 통한 이더 송수신 및 블록 확인
