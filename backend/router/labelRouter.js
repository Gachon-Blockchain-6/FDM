const express = require('express');
const router = express.Router();
const label = require('../lib/label');

// 데이터셋 생성 (관리자용)
router.post('/create-dataset', (req, res) => {
    label.create_dataset(req, res);
});

// 라벨링 투표 제출
router.post('/submit-label', (req, res) => {
    label.submit_label(req, res);
});

// 라벨링 완료 및 판매 시작 (관리자용)
router.post('/complete-labeling', (req, res) => {
    label.complete_labeling(req, res);
});

// 데이터셋 구매
router.post('/purchase', (req, res) => {
    label.purchase_dataset(req, res);
});

// 판매 가능한 데이터셋 목록 조회
router.get('/datasets', (req, res) => {
    // 기본 구현 (추후 확장 가능)
    const db = require('../lib/db');
    db.query(
        `SELECT 
            d.datasetid, 
            d.name, 
            d.price, 
            d.content,
            COUNT(DISTINCT l.imagePath) as image_count,
            COUNT(l.label_id) as label_count
         FROM dataset d 
         LEFT JOIN label l ON d.datasetid = l.datasetid 
         WHERE d.sale_yn = 'Y' 
         GROUP BY d.datasetid, d.name, d.price, d.content
         ORDER BY d.datasetid DESC`,
        (error, results) => {
            if (error) {
                console.error('데이터셋 목록 조회 오류:', error);
                return res.status(500).json({ 
                    success: false, 
                    message: '데이터셋 목록 조회 중 문제가 발생했습니다.' 
                });
            }

            res.status(200).json({ 
                success: true, 
                datasets: results.map(dataset => ({
                    id: dataset.datasetid,
                    name: dataset.name,
                    price: dataset.price,
                    content: dataset.content,
                    imageCount: dataset.image_count || 0,
                    labelCount: dataset.label_count || 0,
                    avgLabelsPerImage: dataset.image_count > 0 ? 
                        (dataset.label_count / dataset.image_count).toFixed(1) : '0'
                }))
            });
        }
    );
});

// 사용자의 구매 이력 조회
router.get('/my-purchases', (req, res) => {
    // 로그인 확인
    if (!req.session.is_logined || req.session.loginid === 'Guest') {
        return res.status(401).json({ 
            success: false, 
            message: '로그인이 필요합니다.' 
        });
    }

    const db = require('../lib/db');
    db.query(
        `SELECT 
            p.purchase_id,
            p.purchased_at,
            p.price,
            p.point,
            p.payYN,
            p.cancel,
            d.name as dataset_name,
            d.content as dataset_content
         FROM purchase p
         JOIN dataset d ON p.datasetid = d.datasetid
         WHERE p.loginid = ?
         ORDER BY p.purchased_at DESC`,
        [req.session.loginid],
        (error, results) => {
            if (error) {
                console.error('구매 이력 조회 오류:', error);
                return res.status(500).json({ 
                    success: false, 
                    message: '구매 이력 조회 중 문제가 발생했습니다.' 
                });
            }

            res.status(200).json({ 
                success: true, 
                purchases: results.map(purchase => ({
                    id: purchase.purchase_id,
                    purchasedAt: purchase.purchased_at,
                    price: purchase.price,
                    usedPoint: purchase.point,
                    actualPayment: purchase.price - purchase.point,
                    isPaid: purchase.payYN === 'Y',
                    isCanceled: purchase.cancel === 'Y',
                    datasetName: purchase.dataset_name,
                    datasetContent: purchase.dataset_content
                }))
            });
        }
    );
});

module.exports = router;
