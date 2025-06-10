const express = require('express');
const router = express.Router();
const label = require('../lib/label');

// 데이터셋 생성 (관리자용)
router.post('/create_dataset', (req, res) => {
    label.create_dataset(req, res);
});


// 데이터셋 목록 보기
router.get('/datasetinfo', (req, res) => {
    label.datasetinfo(req, res);
}); 

// 특정 데이터셋의 모든 상세 정보 조회 (새로 추가된 라우트)
router.get('/dataset/all/:datasetid', (req, res) => {
    label.get_dataset_all_details(req, res);
});

// 특정 데이터셋의 라벨 목록 조회 (이미지 목록)
router.get('/labelinfo/:datasetid', (req, res) => {
    label.labelinfo(req, res);
});

// 특정 데이터셋의 옵션 목록 조회
router.get('/options/:datasetid', (req, res) => {
    label.get_dataset_options(req, res);
});

// 라벨링 투표 제출
router.post('/submit_label', (req, res) => {
    label.submit_label(req, res);
});

// 데이터셋 구매
router.post('/purchase', (req, res) => {
    label.purchase(req, res);
}); 

// 판매 가능한 데이터셋 목록 조회
router.get('/datasets',(req, res) => {
    label.get_datasets(req, res);
});

// 사용자의 구매 이력 조회
router.get('/getPurchases', (req, res) => {
    label.getPurchases(req, res);
});

// 데이터셋의 투표 내역과 이미지 소스 조회
router.get('/dataset/:datasetid/votes-and-images', (req, res) => {
    label.get_dataset_votes_and_images(req, res);
});

// 데이터셋 패키지 다운로드 (JSON + 이미지 ZIP) 
router.get('/download-package/:datasetid', (req, res) => {
    label.download_dataset_package(req, res);
});

module.exports = router;
