const express = require('express');
const router = express.Router();
const label = require('../lib/label');

// 데이터셋 생성 (관리자용)
router.post('/create_dataset', (req, res) => {
    console.log('labelRouter.create_dataset');
    label.create_dataset(req, res);
});

// 라벨링 투표 제출
router.post('/submit_label', (req, res) => {
    label.submit_label(req, res);
});

// 라벨링 목록 조회
router.get('/show_labels', (req, res) => {
    label.show_labels(req, res);
});



// 라벨링 완료 및 판매 시작 (관리자용)
router.post('/complete_labeling', (req, res) => {
    label.complete_labeling(req, res);
});






// 데이터셋 구매
router.post('/purchase_dataset', (req, res) => {
    label.purchase_dataset(req, res);
}); 

// 판매 가능한 데이터셋 목록 조회
router.get('/datasets',(req, res) => {
    console.log('labelRouter.get-datasets');
    label.get_datasets(req, res);
});

// 사용자의 구매 이력 조회
router.get('/my-purchases', (req, res) => {
    console.log('labelRouter.get-my-purchases');
    label.get_my_purchases(req, res);
});

// 특정 데이터셋의 라벨 목록 조회
router.get('/labels/:datasetId', (req, res) => {
    console.log('labelRouter.get-labels-by-dataset');
    label.get_labels_by_dataset(req, res);
});

module.exports = router;
