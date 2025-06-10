const db = require('./db');
const sanitizeHtml = require('sanitize-html');
const Web3 = require('web3').default;
const archiver = require('archiver');
const path = require('path');

// 스마트 컨트랙트 정보 (사용자 제공)
const contractAbi = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"datasetId","type":"uint256"},{"indexed":false,"internalType":"string","name":"name","type":"string"},{"indexed":false,"internalType":"uint256","name":"price","type":"uint256"},{"indexed":false,"internalType":"string","name":"meta","type":"string"},{"indexed":false,"internalType":"address","name":"owner","type":"address"}],"name":"DatasetUploaded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"from","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"to","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"GachonCoinTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"cid","type":"uint256"},{"indexed":false,"internalType":"address","name":"wallet","type":"address"},{"indexed":false,"internalType":"uint256","name":"balance","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"trust","type":"uint256"}],"name":"UserRegistered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"datasetId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"cid","type":"uint256"},{"indexed":false,"internalType":"string","name":"label","type":"string"},{"indexed":false,"internalType":"uint256","name":"trust","type":"uint256"}],"name":"VoteRecorded","type":"event"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"datasets","outputs":[{"internalType":"uint256","name":"datasetId","type":"uint256"},{"internalType":"string","name":"name","type":"string"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"string","name":"meta","type":"string"},{"internalType":"address","name":"owner","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"cid","type":"uint256"}],"name":"getBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"cid","type":"uint256"}],"name":"getUserTrust","outputs":[{"internalType":"uint256","name":"trust","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"datasetId","type":"uint256"}],"name":"getVotes","outputs":[{"internalType":"uint256[]","name":"cids","type":"uint256[]"},{"internalType":"string[]","name":"labels","type":"string[]"},{"internalType":"uint256[]","name":"trusts","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"datasetId","type":"uint256"},{"internalType":"string","name":"name","type":"string"},{"internalType":"uint256","name":"price","type":"uint256"},{"internalType":"string","name":"meta","type":"string"}],"name":"recordDataset","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"datasetId","type":"uint256"},{"internalType":"uint256","name":"cid","type":"uint256"},{"internalType":"string","name":"label","type":"string"},{"internalType":"uint256","name":"trust","type":"uint256"}],"name":"recordVote","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"cid","type":"uint256"},{"internalType":"address","name":"wallet","type":"address"},{"internalType":"uint256","name":"initialBalance","type":"uint256"},{"internalType":"uint256","name":"trust","type":"uint256"}],"name":"registerUser","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"cid","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"rewardUser","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"serverWallet","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_serverWallet","type":"address"}],"name":"setServerWallet","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"cid","type":"uint256"},{"internalType":"address","name":"wallet","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferToServer","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"users","outputs":[{"internalType":"uint256","name":"cid","type":"uint256"},{"internalType":"address","name":"wallet","type":"address"},{"internalType":"uint256","name":"balance","type":"uint256"},{"internalType":"uint256","name":"trust","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"votes","outputs":[{"internalType":"uint256","name":"cid","type":"uint256"},{"internalType":"string","name":"label","type":"string"},{"internalType":"uint256","name":"trust","type":"uint256"}],"stateMutability":"view","type":"function"}];

const contractAddress = '0xfa5063c527b052357496c75bf0b364687f07b46b'; // 사용자 제공 주소
const web3 = new Web3('http://127.0.0.1:8545'); // 사용자 제공 URL
const contractInstance = new web3.eth.Contract(contractAbi, contractAddress);

// Helper function for updating user grades within a transaction
function updateUserGrade(connection, loginid, increase, callback) {
    const grades = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
    connection.query('SELECT grade FROM person WHERE loginid = ?', [loginid], (error, userRows) => {
        if (error) {
            console.warn('updateUserGrade: DB error while fetching user ' + loginid, error);
            return callback(error);
        }
        if (!userRows || userRows.length === 0) {
            console.warn('updateUserGrade: User ' + loginid + ' not found.');
            return callback(null);
        }
        const currentGrade = userRows[0].grade;
        const currentGradeIndex = grades.indexOf(currentGrade);
        if (currentGradeIndex === -1) {
            console.warn('updateUserGrade: User ' + loginid + ' has an invalid grade: ' + currentGrade + '. Defaulting to F.');
            return callback(null);
        }
        let newGradeIndex = currentGradeIndex;
        if (increase) {
            newGradeIndex = Math.min(grades.length - 1, currentGradeIndex + 1);
        } else {
            newGradeIndex = Math.max(0, currentGradeIndex - 1);
        }
        if (grades[newGradeIndex] !== currentGrade) {
            connection.query('UPDATE person SET grade = ? WHERE loginid = ?', [grades[newGradeIndex], loginid], (dbError, result) => {
                if (dbError) {
                    console.warn('updateUserGrade: DB error while updating grade for ' + loginid, dbError);
                    return callback(dbError);
                }
                console.log('User ' + loginid + ' grade updated from ' + currentGrade + ' to ' + grades[newGradeIndex]);
                callback(null);
            });
        } else {
            callback(null);
        }
    });
}

// Helper function for updating votes and grades - 콜백 스타일
function updateVotesAndGradesCallback(connection, finalLabelText, labelId, voteDetails, mainCallback) {
    connection.query('UPDATE vote SET correct = CASE WHEN content = ? THEN \'Y\' ELSE \'N\' END WHERE label_id = ?', [finalLabelText, labelId], (error, result) => {
        if (error) {
            console.error('DB Error updating vote correctness for label ' + labelId + ':', error);
            return mainCallback(error);
        }
        console.log('Vote correctness updated for label ' + labelId);
        const votersToUpdate = {};
        voteDetails.forEach(vote => {
            if (!votersToUpdate[vote.loginid]) {
                votersToUpdate[vote.loginid] = { correct: 0, incorrect: 0, loginid: vote.loginid };
            }
            if (vote.content === finalLabelText) {
                votersToUpdate[vote.loginid].correct++;
            } else {
                votersToUpdate[vote.loginid].incorrect++;
            }
        });
        const voterLoginIds = Object.keys(votersToUpdate);
        let pendingUpdates = voterLoginIds.length;
        if (pendingUpdates === 0) {
            console.log('No user grades to update for label ' + labelId);
            return mainCallback(null);
        }
        let firstError = null;
        voterLoginIds.forEach(loginid_key => {
            const { correct, incorrect, loginid: voterLoginId } = votersToUpdate[loginid_key];
            let increaseGrade = null;
            if (correct > incorrect) {
                increaseGrade = true;
            } else if (incorrect > correct) {
                increaseGrade = false;
            }
            if (increaseGrade !== null) {
                updateUserGrade(connection, voterLoginId, increaseGrade, (err) => {
                    pendingUpdates--;
                    if (err && !firstError) {
                        firstError = err;
                    }
                    if (pendingUpdates === 0) {
                        console.log('User grades update process completed for voters of label ' + labelId);
                        mainCallback(firstError);
                    }
                });
            } else {
                pendingUpdates--;
                if (pendingUpdates === 0) {
                    console.log('User grades update process completed for voters of label ' + labelId + ' (no change for some)');
                    mainCallback(firstError);
                }
            }
        });
    });
}

// 등급을 신뢰도 점수로 변환하는 헬퍼 함수 (auth.js와 유사하게)
const gradeToTrustScore = (grade) => {
    if (grade === 'S') return 100;
    if (grade === 'A') return 90;
    if (grade === 'B') return 70;
    if (grade === 'C') return 50;
    if (grade === 'D') return 40;
    if (grade === 'E') return 30;
    if (grade === 'F') return 20;
    return 60; // 기본값 또는 CST, proxy 등 기타 등급
};

// 신뢰도 점수를 등급 문자열로 변환하는 헬퍼 함수
const trustToLevel = (trustScore) => {
    // FdmDatasetRegistry.sol의 User.trust는 0-100 범위의 신뢰도입니다.
    // gradeToTrustScore 함수의 역매핑 또는 유사한 기준으로 정의합니다.
    if (trustScore >= 95) return 'S'; 
    if (trustScore >= 90) return 'A'; // gradeToTrustScore('A') === 90
    if (trustScore >= 70) return 'B'; // gradeToTrustScore('B') === 70
    if (trustScore >= 50) return 'C'; // gradeToTrustScore('C') === 50
    if (trustScore >= 40) return 'D'; // gradeToTrustScore('D') === 40
    if (trustScore >= 30) return 'E'; // gradeToTrustScore('E') === 30
    if (trustScore >= 0) return 'F';  // gradeToTrustScore('F') === 20 (최저 등급으로 간주)
    return 'N/A'; // 알 수 없거나 유효하지 않은 신뢰도
};

module.exports = {
    // 라벨링 데이터가 포함될 데이터셋을 생성합니다. (관리자용)
    create_dataset: (req, res) => {
        console.log('label.create_dataset');
        if (!db || typeof db.query !== 'function') {
             console.error('Database module (./lib/db.js) is not available or not a valid db object for create_dataset.');
             return res.status(500).json({ success: false, message: '서버 내부 오류: 데이터베이스 모듈을 사용할 수 없습니다.' });
        }
        const { name, price, content, question, options } = req.body;
        console.log('--- Received data for new dataset ---');
        console.log('Name:', name);
        console.log('Price:', price);
        console.log('Content:', content);
        console.log('Question:', question);
        console.log('Options:', options);
        console.log('------------------------------------');
        if (!req.session.is_logined || req.session.cls !== 'MNG') {
            return res.status(403).json({ success: false, message: '데이터셋 생성 권한이 없습니다.' });
        }
        if (!name || !price || !question || !options || !Array.isArray(options) || options.length === 0) {
            return res.status(400).json({ success: false, message: '데이터셋 이름, 가격, 질문, 하나 이상의 옵션을 모두 입력해주세요.' });
        }
        const sanitizedName = sanitizeHtml(name);
        const sanitizedContent = sanitizeHtml(content || '');
        const sanitizedQuestion = sanitizeHtml(question);
        const sanitizedPrice = parseFloat(price);
        const sanitizedOptions = options.map(opt => sanitizeHtml(opt));
        if (isNaN(sanitizedPrice) || sanitizedPrice < 0) {
            return res.status(400).json({ success: false, message: '올바른 가격을 입력해주세요.' });
        }
        db.query(
            'INSERT INTO dataset (name, price, content, sale_yn, question) VALUES (?, ?, ?, ?, ?)',
            [sanitizedName, sanitizedPrice, sanitizedContent, 'Y', sanitizedQuestion],
            (error, results) => {
                if (error) {
                    console.error('DB Error on create_dataset:', error);
                    return res.status(500).json({ success: false, message: '데이터셋 생성 중 문제가 발생했습니다.' });
                }
                const datasetId = results.insertId;
                const optionValues = sanitizedOptions.map(option => [datasetId, option]);
                db.query(
                    'INSERT INTO vote_option (dataset_id, content) VALUES ?',
                    [optionValues],
                    (optionError, optionResults) => {
                        if (optionError) {
                            console.error('DB Error on inserting options:', optionError);
                            return res.status(500).json({ success: false, message: '옵션 저장 중 문제가 발생했습니다.' });
                        }
                        console.log(sanitizedOptions.length + ' options inserted for dataset ID: ' + datasetId);
                        res.status(201).json({
                            success: true,
                            message: '데이터셋과 옵션이 성공적으로 생성되었습니다.',
                            datasetId: datasetId
                        });
                    }
                );
            }
        );
    },
    
    datasetinfo: (req, res) => {
        console.log('label.datasetinfo');
        const { datasetid } = req.params;

        if (!db || typeof db.query !== 'function') {
            console.error('Database module (./lib/db.js) is not available or not a valid db object for datasetinfo.');
            return res.status(500).json({ success: false, message: '서버 내부 오류: 데이터베이스 모듈을 사용할 수 없습니다.' });
        }

        if (datasetid) {
            // 특정 데이터셋 정보 조회 (dataset_id, name, price, content, question)
            const query = 'SELECT dataset_id, name, price, content, question FROM dataset WHERE dataset_id = ?';
            db.query(query, [datasetid], (err, results) => {
                if (err) {
                    console.error('Error fetching specific dataset info:', err);
                    return res.status(500).json({ success: false, message: '데이터베이스 조회 중 오류가 발생했습니다.' });
                }
                if (results.length === 0) {
                    return res.status(404).json({ success: false, message: '해당 ID의 데이터셋을 찾을 수 없습니다.' });
                }
                return res.json({ success: true, data: results[0] });
            });
        } else {
            // 전체 데이터셋 목록 조회 (dataset_id, name, price), 판매 중인 것만 (sale_yn = 'Y')
            const query = "SELECT dataset_id, name, price, sale_yn FROM dataset WHERE sale_yn = 'Y'";
            db.query(query, (err, results) => {
                if (err) {
                    console.error('Error fetching dataset list for upload:', err);
                    return res.status(500).json({ success: false, message: '데이터베이스 조회 중 오류가 발생했습니다.' });
                }
                return res.json({ success: true, datasets: results });
            });
        }
    },

    // 새로운 서비스 함수: 특정 데이터셋의 모든 상세 정보 조회 (콜백 스타일)
    get_dataset_all_details: (req, res) => {
        console.log('label.get_dataset_all_details');
        const { datasetid } = req.params;
        const userCid = req.session.cid;

        if (!db || typeof db.query !== 'function') {
            console.error('Database module (./lib/db.js) is not available for get_dataset_all_details.');
            return res.status(500).json({ success: false, message: '서버 내부 오류: 데이터베이스 모듈을 사용할 수 없습니다.' });
        }
        if (!datasetid) {
            return res.status(400).json({ success: false, message: 'datasetid 파라미터가 필요합니다.' });
        }

        const datasetQuery = 'SELECT * FROM dataset WHERE dataset_id = ?';
        db.query(datasetQuery, [datasetid], (err, results) => {
            if (err) {
                console.error('Error fetching all dataset details for ID: ' + datasetid, err);
                return res.status(500).json({ success: false, message: '데이터베이스 조회 중 오류가 발생했습니다. (dataset)' });
            }
            if (results.length === 0) {
                return res.status(404).json({ success: false, message: '해당 ID의 데이터셋을 찾을 수 없습니다.' });
            }
            const datasetData = results[0];
            if (!req.session.is_logined || !userCid) {
                return res.json({ success: true, data: { ...datasetData, isPurchased: false } });
            }
            const purchaseQuery = 'SELECT COUNT(*) AS purchase_count FROM purchase WHERE dataset_id = ? AND cid = ? AND payYN = \'Y\'';
            db.query(purchaseQuery, [datasetid, userCid], (purchaseErr, purchaseResults) => {
                if (purchaseErr) {
                    console.error('Error checking purchase status for dataset ID: ' + datasetid + ' and user CID: ' + userCid, purchaseErr);
                    return res.json({ success: true, data: { ...datasetData, isPurchased: false, purchaseCheckError: true } });
                }
                const isPurchased = purchaseResults[0].purchase_count > 0;
                return res.json({ success: true, data: { ...datasetData, isPurchased } });
            });
        });
    },

    labelinfo: (req, res) => {
        console.log('label.labelinfo');
        if (!req.session.is_logined) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다. 라벨 정보에 접근하려면 먼저 로그인해주세요.' });
        }
        const { datasetid } = req.params;
        const loginid = req.session.loginid;
        if (!datasetid) {
            return res.status(400).json({ success: false, message: 'datasetid 파라미터가 필요합니다.' });
        }
        const sqlQuery =
            ' SELECT l.label_id, l.source ' +
            ' FROM label l ' +
            ' WHERE l.dataset_id = ? AND l.finalOption IS NULL ' +
            ' AND l.label_id NOT IN ( ' +
            '    SELECT v.label_id ' +
            '    FROM vote v ' +
            '    INNER JOIN person p ON v.cid = p.cid ' +
            '    WHERE p.loginid = ? AND v.label_id IS NOT NULL ' +
            ' ) ';
        const queryParams = [datasetid, loginid];
        db.query(sqlQuery, queryParams, (error, results) => {
            if (error) {
                console.error('DB Error on labelinfo:', error);
                return res.status(500).json({ success: false, message: '라벨 정보를 불러오는 중 문제가 발생했습니다.' });
            }
            res.status(200).json({
                success: true,
                labels: results
            });
        });
    },

    // 특정 데이터셋에 속한 모든 옵션 정보를 가져옵니다.
    get_dataset_options: (req, res) => {
        console.log('label.get_dataset_options');
        if (!db || typeof db.query !== 'function') {
             console.error('Database module (./lib/db.js) is not available or not a valid db object for get_dataset_options.');
             return res.status(500).json({ success: false, message: '서버 내부 오류: 데이터베이스 모듈을 사용할 수 없습니다.' });
        }
        if (!req.session.is_logined) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다. 데이터셋 옵션에 접근하려면 먼저 로그인해주세요.' });
        }
        const { datasetid } = req.params;
        if (!datasetid) {
            return res.status(400).json({ success: false, message: 'datasetid 파라미터가 필요합니다.' });
        }
        db.query(
            'SELECT option_id, content FROM vote_option WHERE dataset_id = ? ORDER BY option_id ASC',
            [datasetid],
            (error, results) => {
                if (error) {
                    console.error('DB Error on get_dataset_options:', error);
                    return res.status(500).json({ success: false, message: '옵션 정보를 불러오는 중 문제가 발생했습니다.' });
                }
                res.status(200).json({
                    success: true,
                    options: results
                });
            }
        );
    },

    // 사용자의 라벨링 선택(투표)을 vote 테이블에 기록합니다.
    submit_label: (req, res) => {
        console.log('label.submit_label');
        if (!db || typeof db.query !== 'function') {
             console.error('Database module (./lib/db.js) is not available or not a valid db object for submit_label.');
             return res.status(500).json({ success: false, message: '서버 내부 오류: 데이터베이스 모듈을 사용할 수 없습니다.' });
        }
        const { label_id, finalOption } = req.body;
        const loginid = req.session.loginid;
        if (!req.session.is_logined || !loginid) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }
        if (!label_id || !finalOption) {
            return res.status(400).json({ success: false, message: '라벨 ID와 선택된 옵션은 필수입니다.' });
        }
        db.query('SELECT cid, grade FROM person WHERE loginid = ?', [loginid], (error, userResults) => {
            if (error) {
                console.error('DB Error on fetching user for vote:', error);
                return res.status(500).json({ success: false, message: '사용자 정보 조회 중 오류 발생' });
            }
            if (!userResults || userResults.length === 0) {
                return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
            }
            const userCid = userResults[0].cid;
            const userGrade = userResults[0].grade;
            db.query(
                'INSERT INTO vote (cid, label_id, content, grade, correct) VALUES (?, ?, ?, ?, ?)',
                [userCid, label_id, finalOption, userGrade, 'N/A'],
                (voteError, voteResult) => {
                    if (voteError) {
                        console.error('DB Error on inserting vote:', voteError);
                        return res.status(500).json({ success: false, message: '투표 기록 중 오류 발생' });
                    }
                    const voteInsertId = voteResult.insertId;
                    console.log('Vote ' + voteInsertId + ' recorded for label_id ' + label_id + ' by user ' + loginid);
                    db.query('SELECT dataset_id FROM label WHERE label_id = ?', [label_id], (metaError, labelMeta) => {
                        if (metaError) {
                            console.error('DB Error on fetching label metadata:', metaError);
                            return res.status(500).json({ success: false, message: '데이터셋 정보 조회 중 오류 발생', voteId: voteInsertId });
                        }
                        if (!labelMeta || labelMeta.length === 0) {
                            console.error('Failed to find dataset_id for label_id ' + label_id);
                            return res.status(200).json({
                                success: true,
                                message: '투표는 기록되었으나, 데이터셋 정보를 찾지 못해 자동 집계를 실행할 수 없습니다.',
                                voteId: voteInsertId
                            });
                        }
                        const datasetIdForClosure = labelMeta[0].dataset_id;
                        // req.app을 close_voting의 세 번째 인자로 전달 (datasetId, labelId, app, callback 순서)
                        module.exports.close_voting(datasetIdForClosure, label_id, req.app, (closeError) => {
                            if (closeError) {
                                console.error('Error during closing process after vote submission:', closeError);
                                return res.status(500).json({
                                    success: false,
                                    message: '투표(ID: ' + voteInsertId + ')는 기록되었으나, 후속 집계 처리 중 오류: ' + (closeError.message || 'Unknown error')
                                });
                            }
                            res.status(200).json({
                                success: true,
                                message: '투표가 성공적으로 기록되었고, 집계 처리가 시도되었습니다.',
                                voteId: voteInsertId
                            });
                        });
                    });
                }
            );
        });
    },

    // 투표를 종료하고, 각 투표 내역을 블록체인에 기록합니다.
    // app 객체를 인자로 받아 web3, contractInstance, deployerAccountAddress를 사용합니다.
    close_voting: async (datasetId, labelId, app, mainCallback) => {
        console.log(`[LABEL_CLOSE_VOTING] Called for datasetId: ${datasetId}, labelId: ${labelId}`);

        const web3 = app.get('web3');
        const contractInstance = app.get('contractInstance');
        const deployerAccountAddress = app.get('deployerAccountAddress');

        if (!web3 || !contractInstance || !deployerAccountAddress) {
            console.error('[LABEL_CLOSE_VOTING] Web3, 계약 인스턴스 또는 배포자 계정 주소를 app 객체에서 찾을 수 없습니다.');
            const err = new Error('서버 내부 설정 오류: 블록체인 연동 설정을 찾을 수 없습니다.');
            return mainCallback(err);
        }

        if (!db || typeof db.query !== 'function' || typeof db.beginTransaction !== 'function') {
             console.error('[LABEL_CLOSE_VOTING] DB 모듈 오류: 트랜잭션을 지원하지 않거나 사용할 수 없습니다.');
             const err = new Error('서버 내부 오류: 데이터베이스 모듈 오류.');
             return mainCallback(err);
        }

        const VOTE_THRESHOLD = 1; // 최소 투표 수 (기존 로직 유지)
        const connection = db; // db 모듈을 connection으로 사용

        connection.beginTransaction(transactionError => {
            if (transactionError) {
                console.error(`[LABEL_CLOSE_VOTING] DB 트랜잭션 시작 오류 (labelId: ${labelId}):`, transactionError);
                return mainCallback(transactionError);
            }

            connection.query('SELECT onchainYn FROM label WHERE label_id = ?', [labelId], (error, labelStatus) => {
                if (error) {
                    console.error(`[LABEL_CLOSE_VOTING] DB 오류 (onchainYn 확인, labelId: ${labelId}):`, error);
                    return connection.rollback(() => mainCallback(error));
                }
                if (labelStatus && labelStatus.length > 0 && labelStatus[0].onchainYn === 'Y') {
                    console.log(`[LABEL_CLOSE_VOTING] Label ${labelId}는 이미 블록체인에 기록되었습니다. 건너<0xEB><0x95><0xB5>니다.`);
                    // 이미 처리된 경우, 트랜잭션 커밋하고 성공 콜백 (롤백하면 다른 작업에 영향 줄 수 있으므로 커밋)
                    return connection.commit(commitErr => {
                        if (commitErr) {
                            console.error(`[LABEL_CLOSE_VOTING] 이미 처리된 labelId ${labelId}의 트랜잭션 커밋 오류:`, commitErr);
                            return mainCallback(commitErr);
                        }
                        mainCallback(null); // 이미 처리되었으므로 성공으로 간주
                    });
                }

                connection.query('SELECT COUNT(*) as voteCount FROM vote WHERE label_id = ?', [labelId], (countError, votes) => {
                    if (countError) {
                        console.error(`[LABEL_CLOSE_VOTING] DB 오류 (투표 수 확인, labelId: ${labelId}):`, countError);
                        return connection.rollback(() => mainCallback(countError));
                    }
                    const voteCount = votes[0].voteCount;
                    console.log(`[LABEL_CLOSE_VOTING] Label ${labelId}의 투표 수: ${voteCount}`);

                    if (voteCount >= VOTE_THRESHOLD) {
                        console.log(`[LABEL_CLOSE_VOTING] 투표 수 충족 (labelId: ${labelId}). 최종 라벨 처리 시작.`);
                        connection.query(
                            'SELECT v.vote_id, v.content, v.cid as user_db_id, p.grade, p.loginid FROM vote v JOIN person p ON v.cid = p.cid WHERE v.label_id = ?',
                            [labelId],
                            async (detailsError, voteDetails) => { // async 키워드 추가
                                if (detailsError) {
                                    console.error(`[LABEL_CLOSE_VOTING] DB 오류 (투표 상세 정보 조회, labelId: ${labelId}):`, detailsError);
                                    return connection.rollback(() => mainCallback(detailsError));
                                }

                                if (!voteDetails || voteDetails.length === 0) {
                                    console.log(`[LABEL_CLOSE_VOTING] 투표 내역이 없습니다 (labelId: ${labelId}). 처리를 중단합니다.`);
                                    // 투표가 없으면 롤백보다는 커밋하고 완료 (오류 상황은 아님)
                                    return connection.commit(commitErr => mainCallback(commitErr)); 
                                }

                                // 1. 최종 라벨 결정 (기존 로직 유지)
                                const gradeWeight = { 'S': 2.0, 'A': 1.5, 'B': 1.2, 'C': 1.0, 'D': 0.8, 'E': 0.5, 'F': 0.2 };
                                const scores = {};
                                voteDetails.forEach(vote => {
                                    scores[vote.content] = (scores[vote.content] || 0) + (gradeWeight[vote.grade] || 0.1);
                                });
                                let finalLabelText = null;
                                let maxScore = -1;
                                for (const optionContent in scores) {
                                    if (scores[optionContent] > maxScore) {
                                        maxScore = scores[optionContent];
                                        finalLabelText = optionContent;
                                    }
                                }
                                if (finalLabelText === null && voteDetails && voteDetails.length > 0) {
                                    finalLabelText = voteDetails[0].content; // 만약 위 로직으로 결정 안되면 첫번째 투표 내용으로 (기존 로직)
                                }

                                if (finalLabelText) {
                                    connection.query('UPDATE label SET finalOption = ? WHERE label_id = ?', [finalLabelText, labelId], async (updateError) => { // async 키워드 추가
                                        if (updateError) {
                                            console.error(`[LABEL_CLOSE_VOTING] DB 오류 (finalOption 업데이트, labelId: ${labelId}):`, updateError);
                                            return connection.rollback(() => mainCallback(updateError));
                                        }
                                        console.log(`[LABEL_CLOSE_VOTING] Label ${labelId}의 finalOption 업데이트: ${finalLabelText}. 등급 업데이트 및 블록체인 기록 시작.`);

                                        // 2. 참여자 등급 업데이트 (기존 로직 호출, 콜백 방식)
                                        updateVotesAndGradesCallback(connection, finalLabelText, labelId, voteDetails, async (gradeUpdateError) => { // async 키워드 추가
                                            if (gradeUpdateError) {
                                                console.error(`[LABEL_CLOSE_VOTING] DB 오류 (등급 업데이트, labelId: ${labelId}):`, gradeUpdateError);
                                                return connection.rollback(() => mainCallback(gradeUpdateError));
                                            }
                                            console.log(`[LABEL_CLOSE_VOTING] 등급 업데이트 완료 (labelId: ${labelId}). 개별 투표 블록체인 기록 시작.`);

                                            // 3. 각 투표를 블록체인의 recordVote로 기록
                                            let lastTransactionHash = null;
                                            let successfullyRecordedVotes = 0; // 성공적으로 기록된 투표 수
                                            try {
                                                for (const vote of voteDetails) {
                                                    const cidForContract = vote.user_db_id; // DB의 person.cid를 스마트 계약의 cid로 사용
                                                    const labelForContract = vote.content;  // 사용자가 투표한 내용
                                                    const trustForContract = gradeToTrustScore(vote.grade); // 투표 당시 등급을 신뢰도 점수로 변환
                                                    
                                                    // 스마트 계약에 사용자가 등록되어 있는지 확인
                                                    try {
                                                        const userOnChain = await contractInstance.methods.users(cidForContract).call();
                                                        if (!userOnChain || userOnChain.wallet === '0x0000000000000000000000000000000000000000') {
                                                            console.warn(`[BC_RECORD_VOTE_SKIP] 사용자 CID ${cidForContract}은(는) 스마트 계약에 등록되어 있지 않습니다. labelId ${labelId}에 대한 해당 사용자의 투표는 건너뜁니다.`);
                                                            continue; // 다음 투표로 넘어감
                                                        }
                                                    } catch (checkError) {
                                                        console.error(`[BC_RECORD_VOTE_SKIP] 스마트 계약에서 사용자 CID ${cidForContract}의 등록 상태 확인 중 오류 발생. 해당 투표를 건너뜁니다. 오류: ${checkError.message}`);
                                                        continue; // 다음 투표로 넘어감
                                                    }

                                                    console.log(`[BC_RECORD_VOTE] 스마트 계약 recordVote 호출: datasetId=${datasetId}, cid=${cidForContract}, label='${labelForContract}', trust=${trustForContract}`);
                                                    
                                                    const currentGasPrice = await web3.eth.getGasPrice();
                                                    console.log(`[BC_CLOSE_VOTE] Recording vote for dataset ${datasetId}, cid ${cidForContract}. Gas price: ${currentGasPrice}`);
                                                    const receipt = await contractInstance.methods.recordVote(datasetId, cidForContract, labelForContract, trustForContract).send({
                                                        from: deployerAccountAddress,
                                                        gas: '250000', // 충분한 가스 한도
                                                        gasPrice: currentGasPrice 
                                                    });
                                                    console.log(`[BC_CLOSE_VOTE] Vote recorded. Tx hash: ${receipt.transactionHash}`);
                                                    lastTransactionHash = receipt.transactionHash; // 마지막 성공한 트랜잭션 해시 저장
                                                    successfullyRecordedVotes++;
                                                }

                                                // 모든 개별 투표가 블록체인에 성공적으로 기록된 후, 또는 기록할 투표가 있었던 경우 label 테이블의 onchainYn 업데이트
                                                if (successfullyRecordedVotes > 0 && lastTransactionHash) {
                                                    connection.query('UPDATE label SET onchainYn = \'Y\', onchainHash = ? WHERE label_id = ?', [lastTransactionHash, labelId], (onchainError) => {
                                                                if (onchainError) {
                                                            console.error(`[LABEL_CLOSE_VOTING] DB 오류 (onchainYn 업데이트, labelId: ${labelId}):`, onchainError);
                                                            return connection.rollback(() => mainCallback(onchainError)); // 롤백
                                                                }
                                                        console.log(`[LABEL_CLOSE_VOTING] Label ${labelId}의 모든 투표 블록체인 기록 완료 및 onchainYn=\'Y\' 업데이트. (마지막 Tx: ${lastTransactionHash})`);
                                                        connection.commit(commitErr => { // 모든 작업 성공 후 DB 커밋
                                                                    if (commitErr) {
                                                                console.error(`[LABEL_CLOSE_VOTING] DB 커밋 오류 (labelId: ${labelId}):`, commitErr);
                                                                        return mainCallback(commitErr);
                                                                    }
                                                            mainCallback(null); // 모든 과정 최종 성공
                                                                });
                                                            });
                                                } else if (voteDetails.length > 0 && successfullyRecordedVotes === 0) {
                                                    // 투표는 있었으나 (voteDetails.length > 0), 등록된 사용자의 유효한 투표가 없어 아무것도 블록체인에 기록되지 않은 경우
                                                    console.warn(`[LABEL_CLOSE_VOTING] labelId ${labelId}에 대한 투표가 있었으나, 스마트 계약에 기록할 수 있는 유효한 투표가 없었습니다. onchainYn은 업데이트되지 않습니다.`);
                                                    connection.commit(commitErr => mainCallback(commitErr)); // DB는 커밋
                                                        } else {
                                                    // 이 경우는 모든 voteDetails 반복문이 (건너뛰기 등으로) 완료되었으나 lastTransactionHash가 없는 경우
                                                    // (예: 모든 사용자가 미등록이어서 successfullyRecordedVotes가 0이거나, voteDetails 자체가 비어있던 경우 등)
                                                    // voteDetails가 비어있던 경우는 이미 위에서 처리됨.
                                                    // 여기는 successfullyRecordedVotes가 0이고 voteDetails도 0이었던 경우 (사실상 발생 어려움) 또는 다른 예외적 상황
                                                    console.warn(`[LABEL_CLOSE_VOTING] 모든 투표가 처리되었으나 마지막 트랜잭션 해시가 없거나 성공적으로 기록된 투표가 없습니다 (labelId: ${labelId}). DB는 커밋합니다.`);
                                                    connection.commit(commitErr => mainCallback(commitErr)); // DB는 커밋, 로직 점검 필요
                                                }

                                            } catch (contractError) {
                                                // cidForContract 변수는 이 catch 블록의 스코프에 없으므로 로그에서 제거합니다.
                                                console.error(`[BC_CLOSE_VOTE_ERROR] 스마트 계약 recordVote 호출 실패 (datasetId: ${datasetId}):`, contractError);
                                                // 개별 투표 기록 실패 시 전체 프로세스를 중단할지, 아니면 로그만 남기고 계속할지 정책 결정 필요
                                                return connection.rollback(() => mainCallback(contractError));
                                            }
                                        });
                                    });
                                } else {
                                    console.log(`[LABEL_CLOSE_VOTING] 최종 라벨을 결정할 수 없습니다 (labelId: ${labelId}). DB는 커밋합니다.`);
                                    connection.commit(commitErr => mainCallback(commitErr)); // 최종 라벨 결정 못해도 DB는 커밋 (기존 로직 유지)
                                }
                            }
                        );
                    } else {
                        console.log(`[LABEL_CLOSE_VOTING] 투표 수가 임계값(${VOTE_THRESHOLD}) 미만입니다 (labelId: ${labelId}). 처리하지 않습니다.`);
                        connection.commit(commitErr => mainCallback(commitErr)); // 처리 안해도 DB는 커밋 (기존 로직 유지)
                    }
                });
            });
        });
    },

    // 데이터셋 구매 (DB호출은 콜백, Web3는 Promise chain)
    purchase: async (req, res) => {
        console.log('label.purchase');
        const { dataset_id } = req.body;
        const loginid = req.session.loginid;
        const userWalletAddress = req.session.walletAddress; // 구매자 지갑 주소 (로그용으로 유지)
        const userCid = req.session.userDbId; // DB에 저장된 사용자의 CID (PK)

        if (!req.session.is_logined) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }
        if (!dataset_id) {
            return res.status(400).json({ success: false, message: '데이터셋 ID가 필요합니다.' });
        }
        // userWalletAddress는 이제 from 주소로 사용되지 않지만, 세션에 있는지 확인하는 것은 유효할 수 있습니다.
        if (!userWalletAddress || !userCid) { 
            return res.status(400).json({ success: false, message: '사용자 지갑 정보 또는 CID가 세션에 없습니다.' });
        }

        const web3 = req.app.get('web3');
        const contractInstance = req.app.get('contractInstance');
        const deployerAccountAddress = req.app.get('deployerAccountAddress'); // 서버 배포자 주소 가져오기

        if (!web3 || !contractInstance) {
            console.error('[LABEL_PURCHASE] Web3 또는 계약 인스턴스를 서버 설정에서 찾을 수 없습니다.');
            return res.status(500).json({ success: false, message: '서버 설정 오류로 구매를 처리할 수 없습니다. (Web3 또는 계약 인스턴스 누락)' });
        }
        if (!deployerAccountAddress) {
            console.error('[LABEL_PURCHASE] Deployer account address not found in app settings.');
            return res.status(500).json({ success: false, message: '서버 설정 오류로 구매를 처리할 수 없습니다. (배포자 주소 누락)' });
        }

        db.query('SELECT price, name FROM dataset WHERE dataset_id = ? AND sale_yn = \'Y\'', [dataset_id], async (err, results) => {
                if (err) {
                console.error('DB Error on fetching dataset price for purchase:', err);
                return res.status(500).json({ success: false, message: '데이터셋 정보 조회 중 오류 발생' });
            }
            if (results.length === 0) {
                return res.status(404).json({ success: false, message: '구매할 수 있는 데이터셋을 찾을 수 없거나 판매 중이 아닙니다.' });
            }
            const datasetPrice = results[0].price;
            const datasetName = results[0].name;

            try {
                console.log(`[BC_PURCHASE] Attempting to purchase dataset ${dataset_id} for ${datasetPrice} GachonCoin by user cid ${userCid}. Transaction will be sent from server account ${deployerAccountAddress}.`);
                
                const balance = await contractInstance.methods.getBalance(userCid).call();
                console.log(`[BC_PURCHASE] User (cid: ${userCid}) current balance: ${balance} GachonCoin`);
                if (BigInt(balance) < BigInt(datasetPrice)) {
                    return res.status(400).json({ success: false, message: '가천코인 잔액이 부족합니다. 현재 잔액: ' + balance });
                }

                const currentGasPrice = await web3.eth.getGasPrice();
                console.log(`[BC_PURCHASE] Current gas price: ${currentGasPrice}`);

                const receipt = await contractInstance.methods.transferToServer(userCid, datasetPrice.toString())
                                    .send({ 
                        from: deployerAccountAddress, // 서버의 배포자 주소로 변경
                        gas: '200000', 
                        gasPrice: currentGasPrice
                    });
                
                console.log(`[BC_PURCHASE] GachonCoin transfer successful. Tx Hash: ${receipt.transactionHash}`);

                // 3. DB에 구매 내역 기록
                db.query('INSERT INTO purchase (dataset_id, cid, price, payYN, transaction_hash, date) VALUES (?, ?, ?, ?, ?, NOW())', 
                    [dataset_id, userCid, datasetPrice, 'Y', receipt.transactionHash],
                    (dbErr, dbResults) => {
                        if (dbErr) {
                            console.error('DB Error on inserting purchase record:', dbErr);
                            return res.status(200).json({ 
                                success: true, 
                                message: '코인 전송은 성공했으나, 구매 내역 기록 중 DB 오류가 발생했습니다. 관리자에게 문의하세요.',
                                transactionHash: receipt.transactionHash,
                                warning_db_error: dbErr.message
                            });
                        }
                        console.log(`Purchase record saved to DB for user cid ${userCid}, dataset ${dataset_id}`);
                        res.status(200).json({
                                            success: true, 
                            message: `데이터셋 '${datasetName}' 구매 및 코인 전송이 성공적으로 완료되었습니다.`,
                            datasetId: dataset_id,
                            datasetName: datasetName,
                            pricePaid: datasetPrice,
                            transactionHash: receipt.transactionHash
                                        });
                                    }
                                );
            } catch (contractError) {
                console.error('[BC_PURCHASE] 스마트 계약 GachonCoin 전송 실패:', contractError);
                let friendlyMessage = '스마트 계약과의 통신 중 오류가 발생하여 구매를 완료할 수 없었습니다.';
                if (contractError.message && contractError.message.includes('insufficient funds')) {
                    friendlyMessage = '지갑에 가스(ETH)가 부족하거나, 지정된 가스 한도가 너무 낮습니다.';
                } else if (contractError.message && contractError.message.includes('revert')) {
                    friendlyMessage = '계약 실행이 실패했습니다. (예: 잔액 부족, 조건 미충족 등)';
                }
                return res.status(500).json({ 
                    success: false, 
                    message: friendlyMessage,
                    error_details: contractError.message 
                });
            }
        });
    },

    // 판매 가능한 데이터셋 목록 조회
    get_datasets: (req, res) => {
        console.log('label.get_datasets');
        if (!db || typeof db.query !== 'function') {
            console.error('Database module (./lib/db.js) is not available or not a valid db object for get_datasets.');
            return res.status(500).json({ success: false, message: '서버 내부 오류: 데이터베이스 모듈을 사용할 수 없습니다.' });
        }
        const query = "SELECT dataset_id, name, price, SUBSTRING(content, 1, 50) as content_preview FROM dataset WHERE sale_yn = 'Y' ORDER BY dataset_id DESC";
        db.query(query, (err, results) => {
            if (err) {
                console.error('Error fetching sale datasets list:', err);
                return res.status(500).json({ success: false, message: '판매 데이터셋 목록 조회 중 오류가 발생했습니다.' });
            }
            return res.json({ success: true, data: results });
        });
    },

    // 사용자의 구매 이력 조회 (콜백 스타일로 이미 잘 되어 있음)
    getPurchases: (req, res) => {
        console.log('label.getPurchases');
        if (!req.session.is_logined || !req.session.cid) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }
        const userCid = req.session.cid;
        if (!db || typeof db.query !== 'function') {
            console.error('Database module is not available for getPurchases.');
            return res.status(500).json({ success: false, message: '서버 내부 오류: DB 모듈 사용 불가.' });
        }
        const query = `
            SELECT 
                p.purchase_id, 
                p.dataset_id, 
                d.name AS dataset_name, 
                p.date AS purchase_date, 
                p.price AS purchase_price,
                p.transaction_hash
            FROM purchase p
            JOIN dataset d ON p.dataset_id = d.dataset_id
            WHERE p.cid = ? AND p.payYN = 'Y'
            ORDER BY p.date DESC
        `;
        db.query(query, [userCid], (err, results) => {
            if (err) {
                console.error('Error fetching user purchases for CID: ' + userCid, err);
                return res.status(500).json({ success: false, message: '구매 이력 조회 중 DB 오류가 발생했습니다.' });
            }
            res.json({ success: true, purchases: results });
        });
    },

    // 데이터셋 다운로드 (콜백 스타일로 변경)
    download_dataset_package: async (req, res) => {
        console.log('[LABEL_DOWNLOAD_PACKAGE] Initiating package download.');
        const { datasetid } = req.params;
        const userCid = req.session.userDbId; // 세션에서 사용자 CID 가져오기 (login_process에서 설정한 userDbId 사용)

        if (!req.session.is_logined || !userCid) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }
        if (!datasetid) {
            return res.status(400).json({ success: false, message: '데이터셋 ID가 필요합니다.' });
        }

        const minioClient = req.app.get('minioClient');
        const minioBucketName = req.app.get('minioBucketName') || 'uploads'; // main.js에서 설정한 버킷 이름 가져오기

        if (!minioClient) {
            console.error('[LABEL_DOWNLOAD_PACKAGE] MinIO client not found in app settings.');
            return res.status(500).json({ success: false, message: '서버 설정 오류 (MinIO 클라이언트 누락)' });
        }

        db.query('SELECT COUNT(*) AS count FROM purchase WHERE dataset_id = ? AND cid = ? AND payYN = \'Y\'', [datasetid, userCid], (purchaseErr, purchaseResults) => {
            if (purchaseErr) {
                console.error('[LABEL_DOWNLOAD_PACKAGE] DB Error checking purchase status:', purchaseErr);
                return res.status(500).json({ success: false, message: '구매 이력 확인 중 DB 오류가 발생했습니다.' });
            }
            if (!purchaseResults || purchaseResults.length === 0 || purchaseResults[0].count === 0) {
                return res.status(403).json({ success: false, message: '이 데이터셋을 구매하지 않았습니다. 다운로드할 수 없습니다.' });
            }

            db.query('SELECT name FROM dataset WHERE dataset_id = ?', [datasetid], (datasetErr, datasetDetailsResults) => {
                if (datasetErr || datasetDetailsResults.length === 0) {
                    console.error('[LABEL_DOWNLOAD_PACKAGE] DB Error fetching dataset name:', datasetErr);
                    return res.status(datasetErr ? 500 : 404).json({ success: false, message: datasetErr ? '데이터셋 정보 조회 중 DB 오류.' : '데이터셋을 찾을 수 없습니다.' });
                }
                const datasetName = datasetDetailsResults[0].name || 'dataset';
                const archiveFileName = `${datasetName.replace(/\s+/g, '_')}_${datasetid}_package.zip`;

                db.query('SELECT source, finalOption FROM label WHERE dataset_id = ? AND finalOption IS NOT NULL AND source IS NOT NULL AND source != \'\'',
                    [datasetid], async (labelErr, labelsResults) => {
                    if (labelErr) {
                        console.error('[LABEL_DOWNLOAD_PACKAGE] DB Error fetching label info:', labelErr);
                        return res.status(500).json({ success: false, message: '라벨 정보 조회 중 DB 오류가 발생했습니다.' });
                    }
                    if (labelsResults.length === 0) {
                        return res.status(404).json({ success: false, message: '다운로드할 확정된 라벨 데이터가 없습니다 (이미지 또는 최종 라벨 누락).' });
                    }

                    const jsonData = {
                        dataset_id: parseInt(datasetid),
                        dataset_name: datasetName,
                        labels: labelsResults.map(label => ({
                            image_filename_in_zip: label.source, // MinIO 객체 이름이 ZIP 내 images 폴더 하위의 파일명이 됨
                            original_minio_object_name: label.source,
                            final_label: label.finalOption
                        }))
                    };

                    res.setHeader('Content-Type', 'application/zip');
                    res.setHeader('Content-Disposition', `attachment; filename="${archiveFileName}"`); // 파일명에 큰따옴표 추가 (공백 등 처리)
                    
                    const archive = archiver('zip', { zlib: { level: 9 } });
                    archive.on('warning', (warnErr) => {
                        console.warn('[ARCHIVER_WARNING]', warnErr);
                        if (!res.headersSent) {
                           // 안전하게 헤더 전송 전이면 오류 응답 시도
                           // res.status(500).json({ success: false, message: 'ZIP 아카이브 생성 중 경고 발생: ' + warnErr.message });
                        } else if (warnErr.code !== 'ENOENT') { // ENOENT는 파일 못찾는 경우로, 아래에서 개별 처리 가능성
                           // 이미 헤더가 전송된 경우, 스트림을 종료하려고 시도할 수 있지만 안정적이지 않을 수 있음
                           // archive.abort(); 
                        }
                    });
                    archive.on('error', (archiveErr) => {
                        console.error('[ARCHIVER_ERROR] ZIP Archive creation error:', archiveErr);
                        if (!res.headersSent) {
                            res.status(500).json({ success: false, message: 'ZIP 아카이브 생성 중 심각한 오류 발생: ' + archiveErr.message });
                        } else {
                            // 이미 응답이 시작된 경우, 에러를 로깅하고 연결을 종료
                            console.error('Headers already sent, cannot send error status for archiver error. Ending response.');
                            res.end();
                        }
                    });
                    archive.pipe(res);

                    archive.append(JSON.stringify(jsonData, null, 2), { name: 'labels_data.json' });

                    const imagePromises = labelsResults.map(label => {
                        return new Promise((resolve, reject) => {
                            const minioObjectName = label.source;
                            if (!minioObjectName) {
                                console.warn(`[LABEL_DOWNLOAD_PACKAGE] Skipping label with empty source for dataset ${datasetid}`);
                                return resolve(); // 소스 정보 없으면 건너뜀 (이미 위에서 필터링했지만, 안전장치)
                            }
                            console.log(`[LABEL_DOWNLOAD_PACKAGE] Attempting to stream from MinIO: ${minioBucketName}/${minioObjectName}`);
                            minioClient.getObject(minioBucketName, minioObjectName, (streamErr, dataStream) => {
                                if (streamErr) {
                                    console.error(`[LABEL_DOWNLOAD_PACKAGE] MinIO getObject error for ${minioBucketName}/${minioObjectName}:`, streamErr);
                                    // 특정 파일 오류 시 전체 중단 대신 경고만 남기고 계속 진행 (resolve로 처리)
                                    // 이렇게 하면 일부 이미지가 누락된 ZIP 파일이 생성될 수 있음. 정책에 따라 reject(streamErr)로 변경 가능.
                                    return resolve({ objectName: minioObjectName, status: 'failed', error: streamErr.message });
                                }
                                archive.append(dataStream, { name: `images/${minioObjectName}` });
                                
                                dataStream.on('end', () => {
                                    console.log(`[LABEL_DOWNLOAD_PACKAGE] Finished streaming ${minioObjectName} to ZIP.`);
                                    resolve({ objectName: minioObjectName, status: 'success' });
                                });
                                dataStream.on('error', (dsErr) => {
                                    console.error(`[LABEL_DOWNLOAD_PACKAGE] Error streaming ${minioObjectName} from MinIO to ZIP:`, dsErr);
                                    resolve({ objectName: minioObjectName, status: 'failed', error: dsErr.message }); // 스트림 오류도 resolve로 넘겨 전체 중단 방지
                                });
                            });
                        });
                    });

                    try {
                        const results = await Promise.all(imagePromises);
                        const failedImages = results.filter(r => r && r.status === 'failed');
                        if (failedImages.length > 0) {
                            console.warn(`[LABEL_DOWNLOAD_PACKAGE] Some images failed to stream from MinIO:`, failedImages);
                            // 실패한 이미지가 있어도 ZIP 파일은 생성될 수 있도록 함. 필요시 여기서 오류 처리.
                        }
                        console.log('[LABEL_DOWNLOAD_PACKAGE] All image streaming attempts finished. Finalizing archive.');
                        await archive.finalize();
                        console.log(`[LABEL_DOWNLOAD_PACKAGE] Archive ${archiveFileName} finalized and sent.`);
                    } catch (processError) {
                        console.error('[LABEL_DOWNLOAD_PACKAGE] Error during image processing or ZIP finalization:', processError);
                        if (!res.headersSent) {
                            res.status(500).json({ success: false, message: processError.message || 'ZIP 파일 최종 처리 중 오류 발생' });
                        } else {
                            console.error('Headers already sent, cannot send error status for finalization error. Ending response.');
                            res.end();
                        }
                    }
                });
            });
        });
    }
};