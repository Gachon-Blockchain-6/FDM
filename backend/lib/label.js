const db = require('./db');
const sanitizeHtml = require('sanitize-html');
// const { Web3 } = require('web3'); // for feature 4

// TODO: Move to a config file
// const web3 = new Web3('YOUR_WEB3_PROVIDER_URL');
// const contractAddress = 'YOUR_CONTRACT_ADDRESS';
// const contractABI = YOUR_CONTRACT_ABI;
// const contract = new web3.eth.Contract(contractABI, contractAddress);

module.exports = {
    /**
     * 1. 데이터셋 생성 기능
     * @description 라벨링 데이터가 포함될 데이터셋을 생성합니다. (관리자용)
     */
    create_dataset: (req, res) => {
        console.log('API: create_dataset');
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
            [sanitizedName, sanitizedPrice, sanitizedContent, 'N'],
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

    /**
     * 2. 투표 기능
     * @description 생성된 데이터셋의 이미지에 대해 라벨을 투표합니다.
     */
    vote_on_label: (req, res) => {
        console.log('API: vote_on_label');
        const { datasetId } = req.params;
        const { imagePath, label } = req.body;

        if (!req.session.is_logined || req.session.loginid === 'Guest') {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }

        if (!datasetId || !imagePath || !label) {
            return res.status(400).json({ success: false, message: '데이터셋 ID, 이미지 경로, 라벨을 모두 입력해주세요.' });
        }

        db.query('SELECT cid, grade FROM person WHERE loginid = ?', [req.session.loginid], (err, userResults) => {
            if (err) {
                console.error('DB Error on vote_on_label (user lookup):', err);
                return res.status(500).json({ success: false, message: '사용자 정보 조회 중 오류가 발생했습니다.' });
            }
            if (userResults.length === 0) {
                return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
            }

            const user = userResults[0];
            const query = 'INSERT INTO label (datasetid, cid, imagePath, grade, label) VALUES (?, ?, ?, ?, ?)';
            const params = [datasetId, user.cid, imagePath, user.grade, label];

            db.query(query, params, (error, results) => {
                if (error) {
                    if (error.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ success: false, message: '이미 해당 이미지에 대한 라벨을 제출하셨습니다.' });
                    }
                    console.error('DB Error on vote_on_label (insert):', error);
                    return res.status(500).json({ success: false, message: '라벨 제출 중 문제가 발생했습니다.' });
                }
                res.status(200).json({ success: true, message: '라벨이 성공적으로 제출되었습니다.', labelId: results.insertId });
            });
        });
    },

    /**
     * 3. 투표 마감 기능
     * @description 투표자 수가 일정 비율을 넘으면 투표를 마감하고 최종 라벨을 결정합니다.
     * - 다수결 * 신뢰도(person.grade)로 최종 라벨을 부여합니다.
     * - 올바른 라벨에 투표한 사용자는 신뢰도를 상승시키고, 그렇지 않은 사용자는 신뢰도를 하락시킵니다.
     * - 최종적으로 4번(upload_to_blockchain)을 호출합니다.
     */
    close_voting_and_finalize_dataset: async (req, res) => {
        console.log('API: close_voting_and_finalize_dataset');
        const { datasetId } = req.params;
        const VOTE_THRESHOLD = 3; // 최소 투표자 수 (이미지 당)

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
    },

    /**
     * 4. 블록체인에 업로드하는 기능
     * @description 최종 확정된 라벨 정보와 기여자 명단을 블록체인에 기록합니다.
     */
    upload_to_blockchain: async (datasetId, finalLabels, contributors) => {
        console.log('execute upload_to_blockchain');
        // CA(인증기관) 및 Web3를 사용한 블록체인 업로드 로직
        // 아래는 주석 처리된 예시 코드입니다.
        /*
        try {
            const gas = await contract.methods.uploadDataset(datasetId, JSON.stringify(finalLabels), contributors).estimateGas();
            const result = await contract.methods.uploadDataset(datasetId, JSON.stringify(finalLabels), contributors).send({ from: 'YOUR_ACCOUNT_ADDRESS', gas });
            console.log('Blockchain transaction success:', result);

            // 데이터베이스에 블록체인 트랜잭션 정보 저장
            // await db.promise().query('UPDATE dataset SET transaction_hash = ? WHERE datasetid = ?', [result.transactionHash, datasetId]);

        } catch (error) {
            console.error('Blockchain transaction failed:', error);
            // 에러 처리 로직 (e.g., 트랜잭션 실패 시 롤백)
            throw new Error('블록체인 업로드에 실패했습니다.');
        }
        */
        console.log(`[Mock] Blockchain Upload for dataset ${datasetId}`);
        console.log(`Final Labels:`, finalLabels);
        console.log(`Contributors:`, contributors);
        return { success: true, transactionHash: '0x' + require('crypto').randomBytes(32).toString('hex') };
    },

    /**
     * 5. 업로드된 데이터셋을 판매하는 기능
     * @description 사용자의 포인트를 소모해서 데이터셋을 구매합니다.
     */
    purchase_dataset: (req, res) => {
        console.log('API: purchase_dataset');
        const { datasetId, usePoint } = req.body;

        if (!req.session.is_logined || req.session.loginid === 'Guest') {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }

        db.query('SELECT * FROM dataset WHERE datasetid = ? AND sale_yn = "Y"', [datasetId], (err, datasetResults) => {
            if (err || datasetResults.length === 0) return res.status(404).json({ success: false, message: '판매 중인 데이터셋을 찾을 수 없습니다.' });
            
            const dataset = datasetResults[0];
            db.query('SELECT point FROM person WHERE loginid = ?', [req.session.loginid], (err, userResults) => {
                const userPoint = userResults[0].point;
                const pointsToUse = parseInt(usePoint) || 0;

                if (pointsToUse > userPoint) {
                    return res.status(400).json({ success: false, message: '보유 포인트가 부족합니다.' });
                }

                db.query('INSERT INTO purchase (datasetid, loginid, price, point, payYN) VALUES (?, ?, ?, ?, "Y")', [datasetId, req.session.loginid, dataset.price, pointsToUse], (err, result) => {
                    if (err) {
                        if (err.code === 'ER_DUP_ENTRY' || err.code === 'ER_DUP_ENTRY_PURCHASE') { // Assuming you have a unique key on (datasetid, loginid) in purchase table
                            return res.status(409).json({ success: false, message: '이미 구매한 데이터셋입니다.' });
                        }
                        return res.status(500).json({ success: false, message: '구매 처리 중 오류 발생' });
                    }

                    if (pointsToUse > 0) {
                        db.query('UPDATE person SET point = point - ? WHERE loginid = ?', [pointsToUse, req.session.loginid]);
                    }
                    res.status(200).json({ success: true, message: '데이터셋을 성공적으로 구매했습니다.' });
                });
            });
        });
    },

    /**
     * 6. 업로드된 데이터셋을 확인하는 기능
     * @description 판매 중인(업로드 완료된) 데이터셋 목록을 조회합니다.
     */
    get_purchasable_datasets: (req, res) => {
        console.log('API: get_purchasable_datasets');
        const query = `
            SELECT d.datasetid, d.name, d.price, d.content, COUNT(l.label_id) as label_count
            FROM dataset d
            LEFT JOIN label l ON d.datasetid = l.datasetid
            WHERE d.sale_yn = 'Y'
            GROUP BY d.datasetid
            ORDER BY d.datasetid DESC`;
            
        db.query(query, (error, results) => {
            if (error) {
                console.error('DB Error on get_purchasable_datasets:', error);
                return res.status(500).json({ success: false, message: '데이터셋 목록 조회 중 문제가 발생했습니다.' });
            }
            res.status(200).json({ success: true, datasets: results });
        });
    },

    /**
     * 7. 판매 완료된 데이터셋을 사용자가 다운로드 받을 수 있도록 제공하는 기능
     * @description 구매한 데이터셋의 이미지와 최종 라벨을 다운로드합니다.
     * - MinIO에서 이미지, 블록체인에서 라벨링 결과를 가져와 JSON으로 묶어 제공합니다.
     */
    download_purchased_dataset: async (req, res) => {
        console.log('API: download_purchased_dataset');
        const { datasetId } = req.params;
        const { loginid } = req.session;

        if (!loginid || loginid === 'Guest') {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }

        try {
            // 1. 구매 이력 확인
            const purchase = await db.promise().query('SELECT * FROM purchase WHERE datasetid = ? AND loginid = ? AND payYN = "Y" AND cancel = "N"', [datasetId, loginid]);
            if (purchase[0].length === 0) {
                return res.status(403).json({ success: false, message: '구매한 데이터셋이 아닙니다.' });
            }

            // 2. 블록체인에서 라벨링 결과 조회 (MOCK)
            // const labelsFromChain = await contract.methods.getDatasetLabels(datasetId).call();
            // const finalLabels = JSON.parse(labelsFromChain);
            const { results: finalLabels } = { results: [ /* Mock data */ { "imagePath": "image1.jpg", "label": "cat" }, { "imagePath": "image2.jpg", "label": "dog" } ] };
            console.log(`[Mock] Fetched labels for dataset ${datasetId} from blockchain.`);


            // 3. MinIO에서 이미지 URL 가져오기 (MOCK)
            // 이 부분은 실제 MinIO SDK를 사용하여 구현해야 합니다.
            const getImageUrlFromMinio = (imagePath) => `https://minio.example.com/datasets/${datasetId}/${imagePath}`;

            // 4. 데이터셋 구성
            const dataset = {
                datasetId,
                files: finalLabels.map(item => ({
                    imagePath: item.imagePath,
                    imageUrl: getImageUrlFromMinio(item.imagePath),
                    label: item.label
                }))
            };

            res.status(200).json({ success: true, dataset });

        } catch (error) {
            console.error('Error on download_purchased_dataset:', error);
            res.status(500).json({ success: false, message: '데이터셋 다운로드 중 오류가 발생했습니다.' });
        }
    }
};
