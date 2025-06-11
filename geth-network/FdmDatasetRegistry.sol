// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC777/ERC777.sol";
import "@openzeppelin/contracts/utils/introspection/IERC1820Registry.sol";

contract FdmDatasetRegistry is ERC777 {
    address public owner;
    uint256 public constant INITIAL_SUPPLY = 1000000 * 10**18;
    
    // ERC-1820 레지스트리
    IERC1820Registry private constant _ERC1820_REGISTRY = IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
    bytes32 private constant _TOKENS_SENDER_INTERFACE_HASH = keccak256("ERC777TokensSender");
    bytes32 private constant _TOKENS_RECIPIENT_INTERFACE_HASH = keccak256("ERC777TokensRecipient");

    struct User {
        uint256 cid;
        address wallet;
        uint256 trust;
    }
    mapping(uint256 => User) public users;

    struct Dataset {
        uint256 datasetId;
        string name;
        uint256 price;
        string meta;
        address owner;
    }
    mapping(uint256 => Dataset) public datasets;

    struct Vote {
        uint256 cid;
        string label;
        uint256 trust;
    }
    mapping(uint256 => Vote[]) public votes;

    address public serverWallet;

    event UserRegistered(uint256 indexed cid, address wallet, uint256 trust);
    event DatasetUploaded(uint256 indexed datasetId, string name, uint256 price, string meta, address owner);
    event VoteRecorded(uint256 indexed datasetId, uint256 indexed cid, string label, uint256 trust);
    event GachonCoinTransferred(uint256 indexed fromCid, uint256 indexed toCid, uint256 amount);

    constructor(address[] memory defaultOperators)
        ERC777("GachonCoin", "GCN", defaultOperators)
    {
        owner = msg.sender;
        _mint(msg.sender, INITIAL_SUPPLY, "", "");
    }

    // 사용자 등록 시 ERC-777 토큰 초기 발급
    function registerUser(
        uint256 cid,
        address wallet,
        uint256 initialBalance,
        uint256 trust
    ) public {
        require(users[cid].wallet == address(0), "User exists");
        _send(msg.sender, wallet, initialBalance, "", "", false);
        users[cid] = User(cid, wallet, trust);
        emit UserRegistered(cid, wallet, trust);
    }

    // ERC-777 잔액 조회
    function getBalance(uint256 cid) public view returns (uint256) {
        return balanceOf(users[cid].wallet);
    }

    // 서버로 토큰 전송 (Operator 기능 사용)
    function transferToServer(uint256 cid, uint256 amount) public {
        require(users[cid].wallet != address(0), "User not registered");
        _operatorSend(
            users[cid].wallet,
            serverWallet,
            amount,
            "",
            "",
            abi.encode(cid, block.timestamp)
        );
        emit GachonCoinTransferred(cid, 0, amount);
    }

    // 신뢰도 기반 토큰 보상 (ERC-777 mint 사용)
    function rewardUser(uint256 cid, uint256 amount) public onlyOwner {
        require(users[cid].trust >= 50, "Low trust score");
        _mint(users[cid].wallet, amount, "", "");
        emit GachonCoinTransferred(0, cid, amount);
    }

    // 데이터셋 등록 기능 (기존 구조 유지)
    function recordDataset(
        uint256 datasetId,
        string memory name,
        uint256 price,
        string memory meta
    ) public {
        datasets[datasetId] = Dataset(datasetId, name, price, meta, msg.sender);
        emit DatasetUploaded(datasetId, name, price, meta, msg.sender);
    }

    // 투표 기능 (기존 구조 유지)
    function recordVote(
        uint256 datasetId,
        uint256 cid,
        string memory label,
        uint256 trust
    ) public {
        require(users[cid].wallet != address(0), "User not registered");
        votes[datasetId].push(Vote(cid, label, trust));
        emit VoteRecorded(datasetId, cid, label, trust);
    }

    // 서버 지갑 설정 및 Operator 등록
    function setServerWallet(address _serverWallet) public onlyOwner {
        serverWallet = _serverWallet;
        _ERC1820_REGISTRY.setInterfaceImplementer(
            address(this),
            _TOKENS_RECIPIENT_INTERFACE_HASH,
            _serverWallet
        );
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    // 토큰 전송 전 신뢰도 검증 훅
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(operator, from, to, amount);
        if(from != address(0)) {
            uint256 cid = _getCidByAddress(from);
            require(users[cid].trust >= 30, "Trust score too low for transfer");
        }
    }

    // 주소로 CID 조회 (내부 함수)
    function _getCidByAddress(address wallet) internal view returns (uint256) {
        for(uint256 i = 1; i < type(uint256).max; i++) {
            if(users[i].wallet == wallet) {
                return i;
            }
        }
        revert("User not found");
    }
}
