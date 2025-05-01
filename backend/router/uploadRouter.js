const express = require('express');
const multer = require('multer');
const Minio = require('minio');
const fs = require('fs');
const path = require('path'); // 파일 경로 작업을 위한 모듈 추가
const db = require('../lib/db');
const router = express.Router();

// Multer 설정 (파일을 임시 저장)
const upload = multer({ dest: 'uploads/' });

// MinIO 클라이언트 설정
const minioClient = new Minio.Client({
    endPoint: 'image-container',
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin',
    pathStyle: true
});

// 파일 업로드 핸들러
router.post('/upload', upload.single('file'), async (req, res) => {
    console.log('uploadRouter called');
    const file = req.file;
    const userName = req.session ? req.session.name : null; // 세션에서 사용자 이름 가져오기

    if (!file) {
        return res.status(400).json({ success: false, message: '파일이 업로드되지 않았습니다.' });
    }

    try {
        const bucketName = 'uploads';
        const originalExtension = path.extname(file.originalname); // 원래 파일의 확장자 추출
        const objectName = `${file.filename}${originalExtension}`; // 새로운 objectName에 확장자 추가
        const filePath = file.path;

        // 파일이 존재하는지 확인 후 MinIO에 업로드
        fs.access(filePath, fs.constants.F_OK, (err) => {
            if (err) {
                console.error('File does not exist:', filePath);
                return res.status(500).json({ success: false, message: '업로드할 파일을 찾을 수 없습니다.' });
            }

            // 파일이 존재할 경우 MinIO로 업로드 시도
            minioClient.fPutObject(bucketName, objectName, filePath, async (err, etag) => {
                if (err) {
                    console.error('File upload error:', err);
                    return res.status(500).json({ success: false, message: '파일 업로드 중 오류가 발생했습니다.' });
                }

                console.log('File uploaded successfully:', etag);

                // 세션에 사용자가 Guest이거나 로그인이 되어 있지 않은 경우 포인트 지급 없이 업로드만 진행
                if (!userName || userName === 'Guest') {
                    return res.status(200).json({
                        success: true,
                        message: 'proxyuser'
                    });
                }

                // 파일 업로드가 성공한 경우 포인트 증가
                try {
                    await db.query('UPDATE person SET point = point + 10 WHERE name = ?', [userName]);
                    console.log('User points updated successfully');
                    res.status(200).json({
                        success: true,
                        message: 'normaluser'
                    });
                } catch (error) {
                    console.error('포인트 업데이트 오류:', error);
                    res.status(500).json({ success: false, message: '포인트 업데이트 중 오류가 발생했습니다.' });
                } finally {
                    // 파일 삭제
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error('임시 파일 삭제 오류:', err);
                        }
                    });
                }
            });
        });
    } catch (error) {
        console.error('파일 업로드 오류:', error);
        res.status(500).json({ success: false, message: '파일 업로드 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
