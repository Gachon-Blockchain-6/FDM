# 설치 가이드
## 1. docker-compose up -d로 모든 프로젝트를 빌드합니다(도커 데스크탑 필요).

## 2. geth attach로 geth 콘솔에 접속합니다.
## 3. admin.addPeer로 geth-1,2,3 노드를 네트워크에 연결합니다.

## 4. personal.newAccount("3238")로 서버에서 사용할 계좌를 생성합니다.
## 5. personal.unlockAccount("지갑 주소", "3238")로 지갑을 해제합니다.
## 6. miner.setEtherbase("0xfb0f69755c6bffb6e1878afc98f2045fa4260674")로 채굴자 주소를 서버 지갑으로 변경합니다
## 7. miner.start()로 채굴을 시작합니다
## 8. main.js의 
const DEPLOYER_ACCOUNT_ADDRESS = "지갑 주소" // geth-node1 hardcoding
const DEPLOYER_ACCOUNT_PASSWORD ="지갑 비밀번호"; // 비밀번호가 없다면 빈 문자열
로 지갑을 설정합니다
## 9. docker-compose up -d --build backend로 백엔드 컨테이너를 다시 시작합니다.

