const db = require('./db');
const sanitizeHtml = require('sanitize-html');
const Web3 = require('web3').default;

// 스마트 컨트랙트 정보 (사용자 제공)
const contractAbi = [
    {
        "inputs": [
            { "internalType": "string", "name": "_name", "type": "string" },
            { "internalType": "uint256", "name": "_bal", "type": "uint256" }
        ],
        "name": "regUser",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "string", "name": "_from", "type": "string" },
            { "internalType": "string", "name": "_to", "type": "string" },
            { "internalType": "uint256", "name": "_amount", "type": "uint256" }
        ],
        "name": "transBal",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "string", "name": "_name", "type": "string" }
        ],
        "name": "checkBal",
        "outputs": [
            { "internalType": "uint256", "name": "", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

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

module.exports = {
    // 라벨링 데이터가 포함될 데이터셋을 생성합니다. (관리자용)
    create_dataset: (req, res) => {
        console.log('label.create_dataset invoked');
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
        console.log('label.labelinfo invoked');
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
        console.log('label.get_dataset_options invoked');
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
                        module.exports.close_voting(datasetIdForClosure, label_id, (closeError) => {
                            if (closeError) {
                                console.error('Error during closing process after vote submission:', closeError);
                                return res.status(500).json({
                                    success: false,
                                    message: '투표(ID: ' + voteInsertId + ')는 기록되었으나, 후속 집계 처리 중 오류: ' + closeError.message
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

    // 투표를 종료하고 라벨링 결과를 블록체인에 기록합니다.
    close_voting: (datasetId, labelId, mainCallback) => {
        console.log('close_voting called for datasetId: ' + datasetId + ', labelId: ' + labelId);
        if (!db || typeof db.query !== 'function' || typeof db.beginTransaction !== 'function') {
             console.error('Database module (./lib/db.js) is not available or not a valid db object with transaction support for close_voting.');
             const err = new Error('서버 내부 오류: 데이터베이스 모듈을 사용할 수 없거나 트랜잭션을 지원하지 않습니다.');
             return mainCallback(err);
        }
        const VOTE_THRESHOLD = 3;
        const connection = db;
        connection.beginTransaction(transactionError => {
            if (transactionError) {
                console.error('Error beginning transaction for label ' + labelId + ':', transactionError);
                return mainCallback(transactionError);
            }
            connection.query('SELECT onchainYn FROM label WHERE label_id = ?', [labelId], (error, labelStatus) => {
                if (error) {
                    console.error('DB Error checking onchainYn for label ' + labelId + ':', error);
                    return connection.rollback(() => mainCallback(error));
                }
                if (labelStatus && labelStatus.length > 0 && labelStatus[0].onchainYn === 'Y') {
                    console.log('Label ' + labelId + ' is already processed and onchain. Skipping.');
                    return connection.commit(commitErr => mainCallback(commitErr));
                }
                connection.query('SELECT COUNT(*) as voteCount FROM vote WHERE label_id = ?', [labelId], (countError, votes) => {
                    if (countError) {
                        console.error('DB Error counting votes for label ' + labelId + ':', countError);
                        return connection.rollback(() => mainCallback(countError));
                    }
                    const voteCount = votes[0].voteCount;
                    console.log('Votes for label ' + labelId + ': ' + voteCount);
                    if (voteCount >= VOTE_THRESHOLD) {
                        console.log('Threshold met for label ' + labelId + '. Processing finalization.');
                        connection.query(
                            'SELECT v.content, v.cid, p.grade, p.loginid FROM vote v JOIN person p ON v.cid = p.cid WHERE v.label_id = ?',
                            [labelId],
                            (detailsError, voteDetails) => {
                                if (detailsError) {
                                    console.error('DB Error fetching vote details for label ' + labelId + ':', detailsError);
                                    return connection.rollback(() => mainCallback(detailsError));
                                }
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
                                    finalLabelText = voteDetails[0].content;
                                }
                                if (finalLabelText) {
                                    connection.query('UPDATE label SET finalOption = ? WHERE label_id = ?', [finalLabelText, labelId], (updateError) => {
                                        if (updateError) {
                                            console.error('DB Error updating finalOption for label ' + labelId + ':', updateError);
                                            return connection.rollback(() => mainCallback(updateError));
                                        }
                                        console.log('Label ' + labelId + ' updated with finalOption: ' + finalLabelText + '. Now updating grades.');

                                        // Step 1: Update votes and grades based on the finalLabelText
                                        updateVotesAndGradesCallback(connection, finalLabelText, labelId, voteDetails, (gradeUpdateError) => {
                                            if (gradeUpdateError) {
                                                console.error('DB Error during grade update for label ' + labelId + ':', gradeUpdateError);
                                                return connection.rollback(() => mainCallback(gradeUpdateError));
                                            }
                                            console.log('Grades updated for label ' + labelId + '. Proceeding to blockchain upload.');

                                            // Step 2: Fetch source and upload to blockchain
                                            connection.query('SELECT source FROM label WHERE label_id = ?', [labelId], (sourceError, labelSourceInfo) => {
                                                if (sourceError) {
                                                    console.error('DB Error fetching source for blockchain for label ' + labelId + ':', sourceError);
                                                    return connection.rollback(() => mainCallback(sourceError));
                                                }
                                                const sourceForBlockchain = labelSourceInfo && labelSourceInfo.length > 0 ? labelSourceInfo[0].source : 'N/A';
                                                const blockchainPayload = [{ label_id: labelId, finalOption: finalLabelText, source: sourceForBlockchain }];

                                                module.exports.upload_to_blockchain(datasetId, blockchainPayload)
                                                    .then(blockchainResult => {
                                                        if (blockchainResult && blockchainResult.success && blockchainResult.hash) {
                                                            connection.query('UPDATE label SET onchainYn = \'Y\', onchainHash = ? WHERE label_id = ?', [blockchainResult.hash, labelId], (onchainError) => {
                                                                if (onchainError) {
                                                                    console.error('DB Error marking label onchain ' + labelId + ':', onchainError);
                                                                    return connection.rollback(() => mainCallback(onchainError));
                                                                }
                                                                console.log('Label ' + labelId + ' marked onchain with hash ' + blockchainResult.hash);
                                                                connection.commit(commitErr => {
                                                                    if (commitErr) {
                                                                        console.error('DB commit error after successful onchain marking for label ' + labelId + ':', commitErr);
                                                                        return mainCallback(commitErr);
                                                                    }
                                                                    mainCallback(null); // All successful
                                                                });
                                                            });
                                                        } else {
                                                            // Blockchain upload itself reported failure (e.g., success:false) or no hash returned.
                                                            // DB changes (finalOption, grade updates) are already part of the transaction.
                                                            // We commit these DB changes but acknowledge blockchain part failed.
                                                            const bcLogicalFailureError = new Error('Blockchain upload failed or returned no hash, but database changes (final option, grades) were committed.');
                                                            console.error('Blockchain upload logical failure for label ' + labelId + ': ' + (blockchainResult ? blockchainResult.error : 'Unknown or no hash from blockchain module'), blockchainResult);
                                                            connection.commit(commitErr => {
                                                                if (commitErr) {
                                                                    console.error('DB commit error after failed blockchain upload for label ' + labelId + ':', commitErr);
                                                                    // Pass original commit error if commit fails
                                                                    return mainCallback(commitErr);
                                                                }
                                                                // Pass the specific error indicating DB success but BC failure.
                                                                mainCallback(bcLogicalFailureError);
                                                            });
                                                        }
                                                    })
                                                    .catch(bcError => { // Promise from upload_to_blockchain was rejected (catastrophic failure)
                                                        console.error('Blockchain upload promise catastrophically failed for label ' + labelId + ':', bcError);
                                                        // Rollback all DB changes (finalOption, grade updates) made in this transaction.
                                                        return connection.rollback(() => mainCallback(bcError));
                                                    });
                                            });
                                        });
                                    });
                                } else {
                                    console.log('Could not determine finalOption for label ' + labelId + '.');
                                    connection.commit(commitErr => mainCallback(commitErr));
                                }
                            }
                        );
                    } else {
                        console.log('Threshold not met for label ' + labelId + '. Current votes: ' + voteCount + '. No action taken.');
                        connection.commit(commitErr => mainCallback(commitErr));
                    }
                });
            });
        });
    },

    upload_to_blockchain: async (datasetId, finalLabelsArray) => {
        try {
            console.log('[블록체인 기록 시작] Dataset ID:', datasetId, 'Labels:', finalLabelsArray);
            const accounts = await web3.eth.getAccounts();
            if (!accounts || accounts.length === 0) {
                console.error('블록체인 기록 중 오류: 사용 가능한 계정이 없습니다.');
                return { success: false, error: 'No accounts available for transaction.' };
            }
            const fromAccount = accounts[0];
            console.log('Using account for transaction:', fromAccount);

            const transactionReceipts = [];

            for (const labelData of finalLabelsArray) {
                const labelIdStr = String(labelData.label_id);
                const nameArg = labelIdStr; // 또는 sourceStr 등 의미있는 문자열
                const balArg = 0; // finalOption이 숫자라면 parseInt(finalOptionStr) 사용 가능

                console.log(`[블록체인] Sending tx for label: ${nameArg}, value: ${balArg}`);

                try {
                    const receipt = await contractInstance.methods.regUser(nameArg, balArg).send({ 
                        from: fromAccount, 
                        gas: '1000000', // 적절한 가스 한도 설정
                        gasPrice: web3.utils.toWei('30', 'gwei') // 적절한 가스 가격 설정
                    });
                    console.log('[블록체인 기록] TxHash for ' + nameArg + ': ' + receipt.transactionHash);
                    transactionReceipts.push({ label_id: labelIdStr, transactionHash: receipt.transactionHash, status: true });
                } catch (txError) {
                    console.error('블록체인 트랜잭션 오류 for ' + nameArg + ':', txError.message);
                    transactionReceipts.push({ label_id: labelIdStr, error: txError.message, status: false });
                    // 하나라도 실패하면 전체 실패로 처리할지, 부분 성공으로 할지 정책 결정 필요
                    // 여기서는 일단 계속 진행하고 결과에 실패 내역 포함
                }
            }

            const allSuccessful = transactionReceipts.every(r => r.status);
            
            if (allSuccessful && transactionReceipts.length > 0) {
                // 모든 트랜잭션이 성공한 경우, 마지막 트랜잭션 해시 또는 모든 해시 배열을 반환할 수 있습니다.
                // 여기서는 첫번째 성공한 트랜잭션의 해시를 대표로 반환 (단일 해시를 기대하는 경우)
                // 또는 모든 해시 정보를 담은 객체/배열을 반환할 수도 있습니다.
                // 기존 로직은 단일 해시를 기대하므로, 첫번째 (또는 마지막) 해시를 반환합니다.
                 const firstSuccessfulTx = transactionReceipts.find(r => r.status);
                return { 
                    success: true, 
                    hash: firstSuccessfulTx ? firstSuccessfulTx.transactionHash : 'N/A', // 모든 트랜잭션 성공 시 대표 해시
                    details: transactionReceipts 
                };
            } else if (transactionReceipts.some(r => r.status)) {
                 // 부분 성공
                const firstSuccessfulTx = transactionReceipts.find(r => r.status);
                return {
                    success: false, // 전체 성공은 아니므로 false로 표시하거나, success: 'partial' 등 다른 상태 사용 가능
                    error: 'Some blockchain transactions failed.',
                    hash: firstSuccessfulTx ? firstSuccessfulTx.transactionHash : 'N/A', // 성공한 것 중 하나의 해시
                    details: transactionReceipts
                };
            } else {
                // 모든 트랜잭션 실패
                return { 
                    success: false, 
                    error: 'All blockchain transactions failed.',
                    details: transactionReceipts
                };
            }

        } catch (err) {
            console.error('블록체인 기록 중 전체 오류:', err);
            return { success: false, error: err.message || 'Blockchain upload failed' };
        }
    },

    // 데이터셋 구매 (DB호출은 콜백, Web3는 Promise chain)
    purchase: (req, res) => {
        console.log('label.purchase');
        if (!req.session.is_logined || !req.session.loginid || !req.session.cid) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }
        const buyerLoginId = req.session.loginid;
        const buyerCid = req.session.cid;
        const { dataset_id } = req.body;

        if (!dataset_id) {
            return res.status(400).json({ success: false, message: '데이터셋 ID가 필요합니다.' });
        }
        if (!db || typeof db.query !== 'function') {
            console.error('Database module is not available for purchase.');
            return res.status(500).json({ success: false, message: '서버 내부 오류: DB 모듈 사용 불가.' });
        }

        db.query('SELECT name, price, sale_yn FROM dataset WHERE dataset_id = ?', [dataset_id], (err, datasetResults) => {
            if (err) {
                console.error('[Purchase DBError] 데이터셋 정보 조회: ', err);
                return res.status(500).json({ success: false, message: '데이터셋 정보 조회 중 DB 오류: ' + err.message });
            }
            if (datasetResults.length === 0) {
                return res.status(404).json({ success: false, message: '존재하지 않는 데이터셋입니다.' });
            }
            if (datasetResults[0].sale_yn !== 'Y') {
                return res.status(400).json({ success: false, message: '현재 판매 중인 데이터셋이 아닙니다.' });
            }
            const datasetInfo = datasetResults[0];
            const datasetPrice = datasetInfo.price;
            const datasetName = datasetInfo.name;

            db.query('SELECT purchase_id FROM purchase WHERE dataset_id = ? AND cid = ? AND payYN = \'Y\'', [dataset_id, buyerCid], (err, existingPurchaseResults) => {
                if (err) {
                    console.error('[Purchase DBError] 구매 이력 확인: ', err);
                    return res.status(500).json({ success: false, message: '구매 이력 확인 중 DB 오류: ' + err.message });
                }
                if (existingPurchaseResults.length > 0) {
                    return res.status(400).json({ success: false, message: '이미 구매한 데이터셋입니다.' });
                }
                const sellerLoginId = 'm';
                contractInstance.methods.checkBal(buyerLoginId).call()
                    .then(buyerBalance_str => {
                        console.log('[Purchase SMC] Buyer (' + buyerLoginId + ') balance: ' + buyerBalance_str);
                        const buyerBalanceBigInt = BigInt(buyerBalance_str);
                        const datasetPriceBigInt = BigInt(datasetPrice);
                        if (buyerBalanceBigInt < datasetPriceBigInt) {
                            return res.status(400).json({ success: false, message: '잔액이 부족합니다. (현재 잔액: ' + buyerBalance_str + ', 필요 금액: ' + datasetPrice + ')' });
                        }
                        web3.eth.getAccounts()
                            .then(accounts => {
                                if (!accounts || accounts.length === 0) {
                                    console.error('[Purchase SMC] 이체 오류: 사용 가능한 Ethereum 계정이 없습니다.');
                                    return res.status(500).json({ success: false, message: '스마트 컨트랙트 오류: Ethereum 계정 없음.' });
                                }
                                const fromAccount = accounts[0];
                                console.log('[Purchase SMC] Attempting to transfer ' + datasetPrice + ' from ' + buyerLoginId + ' (payer: ' + fromAccount + ') to ' + sellerLoginId);
                                return contractInstance.methods.transBal(buyerLoginId, sellerLoginId, datasetPrice.toString())
                                    .send({ 
                                        from: fromAccount, 
                                        gas: '1000000', 
                                        gasPrice: web3.utils.toWei('10', 'gwei')
                                    });
                            })
                            .then(txReceipt => {
                                console.log('[Purchase SMC] 이체 성공: TxHash ' + txReceipt.transactionHash);
                                db.query('INSERT INTO purchase (dataset_id, cid, date, price, payYN, transaction_hash) VALUES (?, ?, NOW(), ?, \'Y\', ?)',
                                    [dataset_id, buyerCid, datasetPrice, txReceipt.transactionHash],
                                    (err, insertResult) => {
                                        if (err) {
                                            console.error('[Purchase DBError] 구매 정보 저장: ', err);
                                            return res.status(500).json({ success: false, message: '구매 정보 저장 실패. TxHash: ' + txReceipt.transactionHash + '. 관리자에게 문의하세요.' });
                                        }
                                        console.log('[Purchase] Purchase record created for dataset_id: ' + dataset_id + ', cid: ' + buyerCid);
                                        return res.json({ 
                                            success: true, 
                                            message: "'" + datasetName + "' 데이터셋 구매가 완료되었습니다.",
                                            transactionHash: txReceipt.transactionHash 
                                        });
                                    }
                                );
                            })
                            .catch(smcError => { 
                                console.error('[Purchase SMC] 이체 또는 계정 조회 오류:', smcError);
                                return res.status(500).json({ success: false, message: '스마트 컨트랙트 처리 실패: ' + smcError.message });
                            });
                    })
                    .catch(smcError => { 
                        console.error('[Purchase SMC] 잔액 확인 오류 for ' + buyerLoginId + ':', smcError);
                        return res.status(500).json({ success: false, message: '스마트 컨트랙트 오류: 사용자 잔액 확인 실패 (' + smcError.message + ')' });
                    });
            });
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
    download_dataset: (req, res) => {
        console.log('label.download_dataset');
        const { dataset_id } = req.params;
        const userCid = req.session.cid;
        const loginid = req.session.loginid;

        if (!loginid) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }
        if (!dataset_id) {
            return res.status(400).json({ success: false, message: '데이터셋 ID가 필요합니다.' });
        }
        if (!db || typeof db.query !== 'function') {
            console.error('Database module is not available for download_dataset.');
            return res.status(500).json({ success: false, message: '서버 내부 오류: DB 모듈 사용 불가.' });
        }

        db.query('SELECT COUNT(*) AS count FROM purchase WHERE dataset_id = ? AND cid = ? AND payYN = \'Y\'', [dataset_id, userCid], (err, purchaseResults) => {
            if (err) {
                console.error('[Download DBError] 구매 이력 확인: ', err);
                return res.status(500).json({ success: false, message: '구매 이력 확인 중 DB 오류: ' + err.message });
            }
            if (!purchaseResults || purchaseResults.length === 0 || purchaseResults[0].count === 0) {
                return res.status(403).json({ success: false, message: '이 데이터셋을 구매하지 않았거나 구매 기록을 찾을 수 없습니다. 다운로드할 수 없습니다.' });
            }
            db.query('SELECT name FROM dataset WHERE dataset_id = ?', [dataset_id], (err, datasetDetailsResults) => {
                if (err) {
                    console.error('[Download DBError] 데이터셋 이름 조회: ', err);
                    return res.status(500).json({ success: false, message: '데이터셋 이름 조회 중 DB 오류: ' + err.message });
                }
                if (datasetDetailsResults.length === 0) {
                    return res.status(404).json({ success: false, message: '데이터셋을 찾을 수 없습니다.' });
                }
                const datasetName = datasetDetailsResults[0].name || 'dataset';
                db.query('SELECT source, finalOption FROM label WHERE dataset_id = ? AND finalOption IS NOT NULL', [dataset_id], (err, labelsResults) => {
                    if (err) {
                        console.error('[Download DBError] 라벨 정보 조회: ', err);
                        return res.status(500).json({ success: false, message: '라벨 정보 조회 중 DB 오류: ' + err.message });
                    }
                    if (labelsResults.length === 0) {
                        return res.status(404).json({ success: false, message: '다운로드할 라벨 데이터가 없습니다 (아직 확정된 라벨이 없거나 데이터셋이 비어있습니다).' });
                    }
                    const jsonData = {
                        dataset_id: parseInt(dataset_id),
                        dataset_name: datasetName,
                        labels: labelsResults.map(label => ({
                            source: label.source,
                            final_option: label.finalOption
                        }))
                    };
                    const fileName = `${datasetName.replace(/\s+/g, '_')}_${dataset_id}.json`;
                    res.setHeader('X-Filename', encodeURIComponent(fileName));
                    return res.status(200).json({ success: true, data: jsonData, fileName: fileName });
                });
            });
        });
    }
};