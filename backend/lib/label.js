const db = require('./db');
const sanitizeHtml = require('sanitize-html');

module.exports = {
     // 라벨링 데이터가 포함될 데이터셋을 생성합니다. (관리자용)
    create_dataset: (req, res) => {
        console.log('label.create_dataset');
        const { name, price, content } = req.body;

        if (!req.session.is_logined || req.session.cls !== 'MNG') {
            return res.status(403).json({ success: false, message: '데이터셋 생성 권한이 없습니다.' });
        }

        if (!name || !price) {
            return res.status(400).json({ success: false, message: '데이터셋 이름과 가격을 입력해주세요.' });
        }

        const sanitizedName = sanitizeHtml(name);
        const sanitizedContent = sanitizeHtml(content || '');
        const sanitizedPrice = parseFloat(price);

        if (isNaN(sanitizedPrice) || sanitizedPrice < 0) {
            return res.status(400).json({ success: false, message: '올바른 가격을 입력해주세요.' });
        }

        db.query(
            'INSERT INTO dataset (name, price, content, sale_yn) VALUES (?, ?, ?, ?)',
            [sanitizedName, sanitizedPrice, sanitizedContent, 'Y'],
            (error, results) => {
                if (error) {
                    console.error('DB Error on create_dataset:', error);
                    return res.status(500).json({ success: false, message: '데이터셋 생성 중 문제가 발생했습니다.' });
                }
                res.status(201).json({ 
                    success: true, 
                    message: '데이터셋이 성공적으로 생성되었습니다.',
                    datasetId: results.insertId
                });
            }
        );
    },
    
    // 사용자에게 보여질 라벨링 데이터셋을 받아옵니다.
    show_label: (req, res) => {
        console.log('label.show_label');
        const { datasetid } = req.params;
        if (!datasetid) {
            return res.status(400).json({ success: false, message: 'datasetid가 필요합니다.' });
        }
        db.query(
            'SELECT * FROM label WHERE datasetid = ?',
            [datasetid],
            (error, results) => {
                if (error) {
                    console.error('DB Error on show_label:', error);
                    return res.status(500).json({ success: false, message: '라벨 조회 중 오류가 발생했습니다.' });
                }
                res.status(200).json({ success: true, labels: results });
            }
        );
    },

    // 사용자가 투표한 라벨링 값을 기록합니다.
    vote_label: (req, res) => {
        console.log('label.vote_label');

        const { datasetid, imagePath, label } = req.body;

        // 로그인 체크
        if (!req.session.is_logined || req.session.loginid === 'Guest') {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }

        // 필수값 체크
        if (!datasetid || !imagePath || !label) {
            return res.status(400).json({ success: false, message: 'datasetid, imagePath, label을 모두 입력해주세요.' });
        }

        // 사용자 정보 조회 (cid, grade)
        db.query('SELECT cid, grade FROM person WHERE loginid = ?', [req.session.loginid], (err, userResults) => {
            if (err) {
                console.error('DB Error on vote_label (user lookup):', err);
                return res.status(500).json({ success: false, message: '사용자 정보 조회 중 오류가 발생했습니다.' });
            }
            if (userResults.length === 0) {
                return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
            }

            const user = userResults[0];
            const query = 'INSERT INTO label (datasetid, cid, imagePath, grade, label) VALUES (?, ?, ?, ?, ?)';
            const params = [datasetid, user.cid, imagePath, user.grade, label];

            db.query(query, params, (error, results) => {
                if (error) {
                    if (error.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ success: false, message: '이미 해당 이미지에 대한 라벨을 제출하셨습니다.' });
                    }
                    console.error('DB Error on vote_label (insert):', error);
                    return res.status(500).json({ success: false, message: '라벨 제출 중 문제가 발생했습니다.' });
                }
                res.status(200).json({ success: true, message: '라벨이 성공적으로 제출되었습니다.', labelId: results.insertId });
            });
        });
    },

    // 투표를 종료하고 라벨링 결과를 블록체인에 기록합니다.
    close_voting_and_finalize_dataset: async (req, res) => {
        console.log('API: close_voting_and_finalize_dataset');
        const { datasetId } = req.params;
        const VOTE_THRESHOLD = 10; // 최소 투표자 수 (이미지 당)

        if (!req.session.is_logined || req.session.cls !== 'MNG') {
            return res.status(403).json({ success: false, message: '권한이 없습니다.' });
        }
        
        try {
            // 투표 현황 확인 (이미지별 투표 수)
            const votes = await db.promise().query('SELECT imagePath, COUNT(*) as voteCount FROM label WHERE datasetid = ? GROUP BY imagePath', [datasetId]);
            if (votes[0].some(v => v.voteCount < VOTE_THRESHOLD)) {
                return res.status(400).json({ success: false, message: `모든 이미지에 최소 ${VOTE_THRESHOLD}개 이상의 투표가 필요합니다.` });
            }

            // 신뢰도 가중치 정의
            const gradeWeight = { 'S': 1.5, 'A': 1.2, 'B': 1.0, 'C': 0.8 };

            // 이미지별 최종 라벨 결정
            const labels = await db.promise().query('SELECT l.imagePath, l.label, p.grade, p.loginid FROM label l JOIN person p ON l.cid = p.cid WHERE l.datasetid = ?', [datasetId]);
            const imagePaths = [...new Set(labels[0].map(l => l.imagePath))];
            
            const finalLabels = [];
            const correctVoters = new Set();
            const incorrectVoters = new Set();

            for (const imagePath of imagePaths) {
                const imageLabels = labels[0].filter(l => l.imagePath === imagePath);
                const score = {};
                imageLabels.forEach(l => {
                    score[l.label] = (score[l.label] || 0) + (gradeWeight[l.grade] || 0.5);
                });

                const finalLabel = Object.keys(score).reduce((a, b) => score[a] > score[b] ? a : b);
                finalLabels.push({ imagePath, label: finalLabel });

                imageLabels.forEach(l => {
                    if (l.label === finalLabel) {
                        correctVoters.add(l.loginid);
                    } else {
                        incorrectVoters.add(l.loginid);
                    }
                });
            }
            
            // 사용자 신뢰도 업데이트 (등급 조정)
            const updateUserGrade = async (loginid, increase) => {
                const grades = ['C', 'B', 'A', 'S'];
                const user = await db.promise().query('SELECT grade FROM person WHERE loginid = ?', [loginid]);
                const currentGradeIndex = grades.indexOf(user[0][0].grade);
                let newGradeIndex = currentGradeIndex;
                if (increase) {
                    newGradeIndex = Math.min(grades.length - 1, currentGradeIndex + 1);
                } else {
                    newGradeIndex = Math.max(0, currentGradeIndex - 1);
                }
                await db.promise().query('UPDATE person SET grade = ? WHERE loginid = ?', [grades[newGradeIndex], loginid]);
            };

            for (const voter of correctVoters) { await updateUserGrade(voter, true); }
            for (const voter of incorrectVoters) { await updateUserGrade(voter, false); }

            // 4. 블록체인에 업로드
            await module.exports.upload_to_blockchain(datasetId, finalLabels, [...correctVoters]);

            // 데이터셋 판매 상태로 변경
            await db.promise().query('UPDATE dataset SET sale_yn = ? WHERE datasetid = ?', ['Y', datasetId]);

            res.status(200).json({ success: true, message: '투표가 마감되고 데이터셋이 최종 확정되었습니다.' });

        } catch (error) {
            console.error('DB Error on close_voting_and_finalize_dataset:', error);
            res.status(500).json({ success: false, message: '작업 중 오류가 발생했습니다.' });
        }
    }

};