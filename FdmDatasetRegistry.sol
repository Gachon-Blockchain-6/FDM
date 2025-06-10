// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

contract FdmDatasetRegistry {
    // 데이터셋 구조체
    struct Dataset {
        uint256 datasetId;
        string name;
        uint256 price;
        bool saleYn;
        string meta;
    }
    mapping(uint256 => Dataset) public datasets;

    // 라벨 후보별 득표수 구조체
    struct LabelVote {
        string label;
        uint256 count;
    }
    mapping(uint256 => LabelVote[]) public datasetLabelVotes;
    mapping(uint256 => string) public datasetFinalLabel;

    // 투표 구조체 (상세 투표 기록)
    struct Vote {
        uint256 voteId;
        uint256 cid;
        uint256 datasetId;
        uint256 labelId;
        string content;
        string grade;
        string correct;
        uint256 createdAt;
    }
    uint256 public voteCount = 0;
    mapping(uint256 => Vote) public votes;

    // 이벤트 정의
    event DatasetUploaded(uint256 indexed datasetId, string name, uint256 price, bool saleYn, string meta);
    event LabelVoteRecorded(uint256 indexed datasetId, string label, uint256 count);
    event FinalLabelRecorded(uint256 indexed datasetId, string finalLabel);
    event VoteRecorded(uint256 indexed voteId, uint256 cid, uint256 datasetId, uint256 labelId, string content, string grade, string correct, uint256 createdAt);

    // 데이터셋 기록 함수
    function recordDataset(
        uint256 _datasetId,
        string memory _name,
        uint256 _price,
        bool _saleYn,
        string memory _meta
    ) public {
        datasets[_datasetId] = Dataset(_datasetId, _name, _price, _saleYn, _meta);
        emit DatasetUploaded(_datasetId, _name, _price, _saleYn, _meta);
    }

    // 라벨별 득표수 기록 함수
    function recordLabelVote(uint256 _datasetId, string memory _label, uint256 _count) public {
        datasetLabelVotes[_datasetId].push(LabelVote(_label, _count));
        emit LabelVoteRecorded(_datasetId, _label, _count);
    }

    // 최종 라벨링 결과 기록 함수
    function recordFinalLabel(uint256 _datasetId, string memory _finalLabel) public {
        datasetFinalLabel[_datasetId] = _finalLabel;
        emit FinalLabelRecorded(_datasetId, _finalLabel);
    }

    // 투표 기록 함수 (상세 투표 기록)
    function recordVote(
        uint256 _cid,
        uint256 _datasetId,
        uint256 _labelId,
        string memory _content,
        string memory _grade,
        string memory _correct
    ) public {
        voteCount += 1;
        votes[voteCount] = Vote(
            voteCount,
            _cid,
            _datasetId,
            _labelId,
            _content,
            _grade,
            _correct,
            block.timestamp
        );
        emit VoteRecorded(voteCount, _cid, _datasetId, _labelId, _content, _grade, _correct, block.timestamp);
    }

    // 단일 투표 조회 함수
    function getVote(uint256 _voteId) public view returns (
        uint256, uint256, uint256, uint256, string memory, string memory, string memory, uint256
    ) {
        Vote memory v = votes[_voteId];
        return (v.voteId, v.cid, v.datasetId, v.labelId, v.content, v.grade, v.correct, v.createdAt);
    }

    // ※ ethers v6에서 배열 구조체 반환이 복잡하므로, 라벨별 득표수 조회 함수를 별도로 추가하는 것이 좋음
    // 예시: function getLabelVote(uint256 _datasetId, uint256 _index) public view returns (string memory, uint256)
    function getLabelVote(uint256 _datasetId, uint256 _index) public view returns (string memory, uint256) {
        LabelVote memory v = datasetLabelVotes[_datasetId][_index];
        return (v.label, v.count);
    }
}
