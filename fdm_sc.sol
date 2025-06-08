// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract DataLabelingMarketplace {
    // 관리자 주소
    address public owner;

    // 데이터셋 존재 여부 (경로 검증용)
    mapping(uint256 => mapping(string => bool)) public validImagePaths; // datasetId => imagePath => exists

    // 라벨링 중복 방지: userId => datasetId => imagePath => labeled
    mapping(uint256 => mapping(uint256 => mapping(string => bool))) public hasLabeled;

    // 구매 중복 방지: userId => datasetId => purchased
    mapping(uint256 => mapping(uint256 => bool)) public hasPurchased;

    // 라벨링 내역
    struct LabelingRecord {
        uint256 userId;
        uint256 datasetId;
        string imagePath;
        string label;
        bytes32 labelHash;
        uint256 timestamp;
    }
    LabelingRecord[] public labelingRecords;

    // 구매 내역
    struct PurchaseRecord {
        uint256 userId;
        uint256 datasetId;
        address buyer;
        uint256 amount;
        uint256 timestamp;
    }
    PurchaseRecord[] public purchaseRecords;

    // 이벤트
    event LabelSubmitted(
        uint256 indexed userId,
        uint256 indexed datasetId,
        string imagePath,
        string label,
        bytes32 labelHash,
        uint256 timestamp
    );

    event DatasetPurchased(
        uint256 indexed userId,
        uint256 indexed datasetId,
        address indexed buyer,
        uint256 amount,
        uint256 timestamp
    );

    // 소유자(관리자) 전용 modifier
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // 데이터셋 이미지 경로 등록 (관리자만)
    function addImagePath(uint256 datasetId, string calldata imagePath) external onlyOwner {
        validImagePaths[datasetId][imagePath] = true;
    }

    // 라벨 제출
    function submitLabel(
        uint256 userId,
        uint256 datasetId,
        string calldata imagePath,
        string calldata label
    ) external {
        // 경로 유효성 검증
        require(validImagePaths[datasetId][imagePath], "Invalid image path. Please re-enter.");

        // 중복 라벨링 방지
        require(!hasLabeled[userId][datasetId][imagePath], "Already labeled by this user.");

        // 라벨 해시 생성
        bytes32 labelHash = keccak256(abi.encodePacked(label));

        // 기록
        hasLabeled[userId][datasetId][imagePath] = true;
        labelingRecords.push(LabelingRecord({
            userId: userId,
            datasetId: datasetId,
            imagePath: imagePath,
            label: label,
            labelHash: labelHash,
            timestamp: block.timestamp
        }));

        emit LabelSubmitted(userId, datasetId, imagePath, label, labelHash, block.timestamp);
    }

    // 데이터셋 구매 (ETH, gwei 단위)
    function purchaseDataset(
        uint256 userId,
        uint256 datasetId
    ) external payable {
        // 중복 구매 방지
        require(!hasPurchased[userId][datasetId], "Already purchased by this user.");

        // 결제 금액은 프론트/백에서 결정, 여기서는 검증 생략

        hasPurchased[userId][datasetId] = true;
        purchaseRecords.push(PurchaseRecord({
            userId: userId,
            datasetId: datasetId,
            buyer: msg.sender,
            amount: msg.value,
            timestamp: block.timestamp
        }));

        emit DatasetPurchased(userId, datasetId, msg.sender, msg.value, block.timestamp);
    }

    // 관리자: 라벨링 내역 전체 조회
    function getAllLabelingRecords() external view onlyOwner returns (LabelingRecord[] memory) {
        return labelingRecords;
    }

    // 관리자: 구매 내역 전체 조회
    function getAllPurchaseRecords() external view onlyOwner returns (PurchaseRecord[] memory) {
        return purchaseRecords;
    }

    // (선택) 컨트랙트 잔고 출금 (관리자만)
    function withdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
