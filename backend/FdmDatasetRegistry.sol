// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

contract FdmDatasetRegistry {
    address public owner; // 계약 소유자 (배포자)

    struct User {
        uint256 cid;        // 사용자 식별자
        address wallet;     // 지갑 주소 (온체인 식별용, 실제 거래는 내부 balance로)
        uint256 balance;    // 가천코인 잔고 (내부 화폐)
        uint256 trust;      // 신뢰도(0~100)
    }
    mapping(uint256 => User) public users;

    struct Dataset {
        uint256 datasetId;  // 데이터셋 고유 번호
        string name;        // 이름
        uint256 price;      // 가격 (가천코인)
        string meta;        // 메타데이터
        address owner;      // 데이터셋 등록자 주소 (이더리움 주소)
    }
    mapping(uint256 => Dataset) public datasets;

    struct Vote {
        uint256 cid;        // 투표자 식별자
        string label;       // 라벨명
        uint256 trust;      // 신뢰도
    }
    mapping(uint256 => Vote[]) public votes;

    address public serverWallet; // 서버의 온체인 지갑 주소 (ETH 등 수령 목적)

    event UserRegistered(uint256 indexed cid, address wallet, uint256 balance, uint256 trust);
    event DatasetUploaded(uint256 indexed datasetId, string name, uint256 price, string meta, address owner);
    event VoteRecorded(uint256 indexed datasetId, uint256 indexed cid, string label, uint256 trust);
    event GachonCoinTransferred(uint256 indexed fromUserCid, uint256 indexed toUserCidOrConcept, uint256 amount); // fromCid, to (0 for server)

    constructor() {
        owner = msg.sender; // 계약 배포자를 owner로 설정
    }

    function registerUser(
        uint256 cid,
        address wallet,
        uint256 initialBalance,
        uint256 trust
    ) public {
        // 이 함수는 owner만 호출하도록 제한할 수도 있습니다 (예: 관리자가 사용자 일괄 등록 시)
        // 현재는 누구나 호출 가능 (애플리케이션 로직에서 호출 주체를 서버로 제한)
        require(users[cid].wallet == address(0), unicode"이미 가입된 사용자입니다.");
        users[cid] = User(cid, wallet, initialBalance, trust);
        emit UserRegistered(cid, wallet, initialBalance, trust);
    }

    function getUserTrust(uint256 cid) public view returns (uint256 trust) {
        return users[cid].trust;
    }

    function getBalance(uint256 cid) public view returns (uint256) {
        return users[cid].balance;
    }

    function recordDataset(
        uint256 datasetId,
        string memory name,
        uint256 price,
        string memory meta
    ) public {
        // 데이터셋 등록은 owner (서버 관리자)만 가능하도록 제한하는 것이 일반적일 수 있습니다.
        // require(msg.sender == owner, "Only contract owner can record a dataset.");
        datasets[datasetId] = Dataset(datasetId, name, price, meta, msg.sender); // msg.sender를 owner로 할지, 아니면 서버주소를 owner로 할지. 현재는 호출자.
        emit DatasetUploaded(datasetId, name, price, meta, msg.sender);
    }

    function recordVote(
        uint256 datasetId,
        uint256 cid,
        string memory label,
        uint256 trust
    ) public {
        // 투표 기록은 서버(owner)가 취합하여 일괄적으로 호출할 수도 있고,
        // 현재처럼 사용자가 (또는 사용자를 대신하여 앱서버가) 직접 호출할 수도 있습니다.
        // 사용자가 직접 호출한다면 msg.sender가 해당 사용자의 wallet address여야 하지만,
        // 현재는 서버가 cid를 받아 대신 기록하는 방식입니다.
        // require(msg.sender == owner, "Only contract owner can record votes if processed centrally.");
        require(users[cid].wallet != address(0), unicode"회원가입된 사용자만 투표 가능 (내부 cid 기준)");
        votes[datasetId].push(Vote(cid, label, trust));
        emit VoteRecorded(datasetId, cid, label, trust);
    }

    function getVotes(
        uint256 datasetId
    ) public view returns (
        uint256[] memory cids,
        string[] memory labels,
        uint256[] memory trusts
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

    function setServerWallet(address _serverWallet) public {
        require(msg.sender == owner, "Only contract owner can set the server wallet.");
        serverWallet = _serverWallet;
    }

    // 사용자의 내부 가천코인을 서버(시스템)로 이전 (구매 시 사용)
    function transferToServer(uint256 userCid, uint256 amount) public {
        require(msg.sender == owner, "Only contract owner can initiate this transfer."); // 서버(owner)만 호출 가능
        require(users[userCid].wallet != address(0), "User to debit is not registered."); // 차감할 사용자가 등록되어 있는지 확인
        require(users[userCid].balance >= amount, unicode"사용자의 가천코인 잔고가 부족합니다.");
        // serverWallet 존재 여부 확인은 유지할 수 있음 (서버 시스템의 일반 설정 확인 차원)
        // require(serverWallet != address(0), unicode"서버 지갑이 설정되지 않았습니다."); 

        users[userCid].balance -= amount;
        // 서버의 내부 GachonCoin 잔액을 별도로 관리하려면 여기에 로직 추가 (예: users[SERVER_CID].balance += amount)
        // 현재는 사용자의 잔액만 차감하고, 해당 코인이 시스템으로 귀속된 것으로 간주.
        emit GachonCoinTransferred(userCid, 0, amount); // toUserCidOrConcept = 0은 서버/시스템을 의미
    }

    function rewardUser(uint256 userCid, uint256 amount) public {
        require(msg.sender == owner, "Only contract owner can reward users."); // 서버(owner)만 호출 가능
        require(users[userCid].wallet != address(0), "User to reward is not registered.");
        users[userCid].balance += amount;
        // GachonCoinTransferred 이벤트 발생시켜도 좋음 (from = 0, to = userCid, amount)
        // emit GachonCoinTransferred(0, userCid, amount); // 예시
    }
}
