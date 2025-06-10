const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path'); // 파일 경로 작업을 위한 모듈 추가
const db = require('../lib/db');
const router = express.Router();

// Multer 설정 (파일을 임시 저장)
const upload = multer({ dest: 'uploads/' });

// 파일 업로드 핸들러
router.post('/upload', upload.single('file'), async (req, res) => {
    console.log('uploadRouter called');
    const file = req.file;
    const userName = req.session ? req.session.name : null; // 세션에서 사용자 이름 가져오기
    const { dataset_ids } = req.body; // 프론트에서 전송된 데이터셋 ID 목록

    // main.js에서 설정된 MinIO 클라이언트 가져오기
    const minioClient = req.app.get('minioClient');
    if (!minioClient) {
        console.error('[UPLOAD_ROUTER] MinIO client not found in app settings.');
        // 임시 파일이 있다면 삭제 처리 필요
        if (file && file.path) {
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting temp file on MinIO client fail:', unlinkErr);
            });
        }
        return res.status(500).json({ success: false, message: '서버 설정 오류 (MinIO 클라이언트 누락)' });
    }

    if (!file) {
        return res.status(400).json({ success: false, message: '파일이 업로드되지 않았습니다.' });
    }
    if (!dataset_ids) {
        // 임시 파일 삭제
        fs.unlink(file.path, (unlinkErr) => {
            if (unlinkErr) console.error('Error deleting temp file on missing dataset_ids:', unlinkErr);
        });
        return res.status(400).json({ success: false, message: '데이터셋이 선택되지 않았습니다.' });
    }

    try {
        const bucketName = 'uploads'; // 일관성을 위해 이 값도 main.js에서 app.set으로 관리 가능
        const originalExtension = path.extname(file.originalname); // 원래 파일의 확장자 추출
        const objectName = `${file.filename}${originalExtension}`; // 새로운 objectName에 확장자 추가
        const filePath = file.path;

        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error('File does not exist:', filePath);
                return res.status(500).json({ success: false, message: '업로드할 파일을 찾을 수 없습니다.' });
            }

            minioClient.fPutObject(bucketName, objectName, filePath, async (putErr, etag) => {
                // 임시 파일은 성공/실패 여부와 관계없이 fPutObject 콜백 내에서 최종적으로 삭제하는 것이 좋음
                const cleanupTempFile = () => {
                    fs.unlink(filePath, (unlinkErr) => {
                        if (unlinkErr) console.error('임시 파일 삭제 오류:', unlinkErr);
                        else console.log('임시 파일 삭제 성공:', filePath);
                    });
                };

                if (putErr) {
                    console.error('MinIO fPutObject error:', putErr);
                    cleanupTempFile();
                    return res.status(500).json({ success: false, message: 'MinIO 파일 업로드 중 오류가 발생했습니다.' });
                }

                console.log('File uploaded successfully to MinIO:', etag);

                try {
                    const ids = dataset_ids.split(',');
                    const sourcePath = objectName; // MinIO 내 객체 이름 (확장자 포함)

                    for (const id of ids) {
                        await db.query(
                            'INSERT INTO label (dataset_id, onchainYn, source, finalOption) VALUES (?, ?, ?, ?)',
                            [id, 'N', sourcePath, null]
                        );
                    }
                    console.log('Label info inserted successfully for dataset IDs:', ids);

                } catch (dbError) {
                    console.error('라벨 정보 저장 오류:', dbError);
                    minioClient.removeObject(bucketName, objectName, (rmErr) => {
                        if (rmErr) console.error('MinIO 파일 삭제 오류 (롤백 실패):', rmErr);
                        else console.log('MinIO 파일 삭제 성공 (롤백):', objectName);
                    });
                    cleanupTempFile();
                    return res.status(500).json({ success: false, message: '라벨 정보 저장 중 오류가 발생했습니다.' });
                }

                if (!userName || userName === 'Guest') {
                    cleanupTempFile();
                    return res.status(200).json({
                        success: true,
                        message: 'proxyuser'
                    });
                }

                try {
                    await db.query('UPDATE person SET point = point + 10 WHERE name = ?', [userName]);
                    console.log('User points updated successfully');
                    cleanupTempFile();
                    res.status(200).json({
                        success: true,
                        message: 'normaluser'
                    });
                } catch (pointError) {
                    console.error('포인트 업데이트 오류:', pointError);
                    // DB 저장 성공, 포인트 업데이트 실패 시 MinIO 파일은 유지 (정책에 따라 다를 수 있음)
                    cleanupTempFile();
                    res.status(500).json({ success: false, message: '포인트 업데이트 중 오류가 발생했습니다.' });
                }
            });
        });
    } catch (error) {
        console.error('파일 업로드 처리 중 예외:', error);
        if (file && file.path) { // 예외 발생 시에도 임시 파일 삭제 시도
            fs.unlink(file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting temp file on exception:', unlinkErr);
            });
        }
        res.status(500).json({ success: false, message: '파일 업로드 처리 중 예외가 발생했습니다.' });
    }
});

module.exports = router;
