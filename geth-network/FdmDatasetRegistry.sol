// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

contract FdmDatasetRegistry {
    struct User {
        uint256 cid;        // 사용자 식별자
        address wallet;     // 지갑 주소
        uint256 balance;    // 가천코인 잔고
        uint256 trust;      // 신뢰도(0~100)
    }
    mapping(uint256 => User) public users; // cid => User

    struct Dataset {
        uint256 datasetId;  // 데이터셋 고유 번호
        string name;        // 이름
        uint256 price;      // 가격(가천코인)
        string meta;        // 메타데이터
        address owner;      // 등록자 주소
    }
    mapping(uint256 => Dataset) public datasets; // datasetId => Dataset

    struct Vote {
        uint256 cid;        // 투표자 식별자
        string label;       // 라벨명
        uint256 trust;      // 신뢰도
    }
    mapping(uint256 => Vote[]) public votes; // datasetId => Vote[]

    address public serverWallet; // 서버(운영자) 지갑 주소

    event UserRegistered(uint256 indexed cid, address wallet, uint256 balance, uint256 trust); // 회원가입 이벤트
    event DatasetUploaded(uint256 indexed datasetId, string name, uint256 price, string meta, address owner); // 데이터셋 등록 이벤트
    event VoteRecorded(uint256 indexed datasetId, uint256 indexed cid, string label, uint256 trust); // 투표 이벤트
    event GachonCoinTransferred(uint256 indexed from, uint256 indexed to, uint256 amount); // 송금 이벤트

    function registerUser(       // 사용자 등록 함수
        uint256 cid,             // 사용자 식별자
        address wallet,          // 지갑 주소
        uint256 initialBalance,  // 초기 잔고
        uint256 trust            // 신뢰도(가입 시)
    ) public {
        require(users[cid].wallet == address(0), unicode"이미 가입된 사용자입니다.");
        users[cid] = User(cid, wallet, initialBalance, trust);
        emit UserRegistered(cid, wallet, initialBalance, trust);
    }

    function getUserTrust(uint256 cid) public view returns (uint256 trust) { // 신뢰도 반환 함수
        return users[cid].trust;
    }

    function getBalance(uint256 cid) public view returns (uint256) { // 잔고 반환 함수
        return users[cid].balance;
    }

    function recordDataset(  // 데이터셋 기록 함수
        uint256 datasetId,   // 데이터셋 번호
        string memory name,  // 이름
        uint256 price,       // 가격
        string memory meta   // 메타데이터
    ) public {
        datasets[datasetId] = Dataset(datasetId, name, price, meta, msg.sender);
        emit DatasetUploaded(datasetId, name, price, meta, msg.sender);
    }

    function recordVote(     // 투표 기록 함수
        uint256 datasetId,   // 데이터셋 번호
        uint256 cid,         // 투표자 식별자
        string memory label, // 라벨명
        uint256 trust        // 신뢰도(투표 시)
    ) public {
        require(users[cid].wallet != address(0), unicode"회원가입된 사용자만 투표 가능");
        votes[datasetId].push(Vote(cid, label, trust));
        emit VoteRecorded(datasetId, cid, label, trust);
    }

    function getVotes(       // 투표 조회 함수
        uint256 datasetId    // 데이터셋 번호
    ) public view returns (
        uint256[] memory cids,    // 투표자 배열
        string[] memory labels,   // 라벨명 배열
        uint256[] memory trusts   // 신뢰도 배열
    ) {
        uint256 len = votes[datasetId].length;
        cids = new uint256[](len);
        labels = new string[](len);
        trusts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            Vote memory v = votes[datasetId][i];
            cids[i] = v.cid;
            labels[i] = v.label;
            trusts[i] = v.trust;
        }
        return (cids, labels, trusts);
    }

    function setServerWallet(address _serverWallet) public { // 서버 지갑 등록/수정 함수
        serverWallet = _serverWallet; 
    }

    function transferToServer(uint256 cid, uint256 amount) public { // 서버로 송금 함수
        require(users[cid].balance >= amount, unicode"잔고 부족");
        require(serverWallet != address(0), unicode"서버 지갑 설정 필요");
        users[cid].balance -= amount;
        emit GachonCoinTransferred(cid, 0, amount);
    }

    function rewardUser(uint256 cid, uint256 amount) public { // 사용자 보상(코인 지급) 함수수
        users[cid].balance += amount; 
    }
}
