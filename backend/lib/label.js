const db = require('./db');
const sanitizeHtml = require('sanitize-html');

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
        db.query('SELECT * FROM dataset ORDER BY dataset_id DESC', (error, results) => {
            if (error) {
                console.error('DB Error on getting datasets:', error);
                return res.status(500).json({ success: false, message: '데이터셋 목록을 불러오는 중 문제가 발생했습니다.' });
            }
            res.status(200).json({
                success: true,
                datasets: results
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
                                        console.log('Label ' + labelId + ' updated with finalOption: ' + finalLabelText);
                                        connection.query('SELECT source FROM label WHERE label_id = ?', [labelId], (sourceError, labelSourceInfo) => {
                                            if (sourceError) {
                                                console.error('DB Error fetching source for label ' + labelId + ':', sourceError);
                                                return connection.rollback(() => mainCallback(sourceError));
                                            }
                                            const sourceForBlockchain = labelSourceInfo && labelSourceInfo.length > 0 ? labelSourceInfo[0].source : 'N/A';
                                            const blockchainPayload = [{ label_id: labelId, finalOption: finalLabelText, source: sourceForBlockchain }];
                                            module.exports.upload_to_blockchain(datasetId, blockchainPayload)
                                                .then(blockchainResult => {
                                                    if (blockchainResult && blockchainResult.success) {
                                                        connection.query('UPDATE label SET onchainYn = \'Y\', onchainHash = ? WHERE label_id = ?', [blockchainResult.hash, labelId], (onchainError) => {
                                                            if (onchainError) {
                                                                console.error('DB Error marking label onchain ' + labelId + ':', onchainError);
                                                                return connection.rollback(() => mainCallback(onchainError));
                                                            }
                                                            console.log('Label ' + labelId + ' marked onchain with hash ' + blockchainResult.hash);
                                                            updateVotesAndGradesCallback(connection, finalLabelText, labelId, voteDetails, (gradeUpdateError) => {
                                                                if (gradeUpdateError) return connection.rollback(() => mainCallback(gradeUpdateError));
                                                                connection.commit(commitErr => mainCallback(commitErr));
                                                            });
                                                        });
                                                    } else {
                                                        console.error('Blockchain upload failed for label ' + labelId + '. Error: ' + (blockchainResult ? blockchainResult.error : 'Unknown error'));
                                                        updateVotesAndGradesCallback(connection, finalLabelText, labelId, voteDetails, (gradeUpdateError) => {
                                                            if (gradeUpdateError) return connection.rollback(() => mainCallback(gradeUpdateError));
                                                            connection.commit(commitErr => mainCallback(commitErr));
                                                        });
                                                    }
                                                })
                                                .catch(bcError => {
                                                    console.error('Blockchain upload promise failed for label ' + labelId + ':', bcError);
                                                    return connection.rollback(() => mainCallback(bcError));
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

    /**
     * 블록체인에 라벨링 결과를 기록합니다.
     * @param {number} datasetId - 데이터셋 ID
     * @param {Array} finalLabels - [{ imagePath, label, correctVoters, incorrectVoters }]
     */
    upload_to_blockchain: async (datasetId, finalLabelsArray) => {
        try {
            const record = {
                datasetId,
                results: finalLabelsArray,
                timestamp: new Date().toISOString()
            };
            const dummyHash = '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
            console.log('[블록체인 기록] 데이터:', JSON.stringify(record, null, 2));
            console.log('[블록체인 기록] Simulated TxHash: ' + dummyHash + ' for dataset ' + datasetId);
            return { success: true, hash: dummyHash };
        } catch (err) {
            console.error('블록체인 기록 중 오류:', err);
            return { success: false, error: err.message || 'Blockchain upload failed' };
        }
    }
};