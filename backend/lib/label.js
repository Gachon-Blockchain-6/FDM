const db = require('./db');
const sanitizeHtml = require('sanitize-html');

// Helper function for updating user grades within a transaction
async function updateUserGrade(connection, loginid, increase) {
    const grades = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
    const [userRows] = await connection.query('SELECT grade FROM person WHERE loginid = ?', [loginid]);
    if (userRows.length === 0) {
        console.warn(`updateUserGrade: User ${loginid} not found.`);
        return;
    }
    const currentGrade = userRows[0].grade;
    const currentGradeIndex = grades.indexOf(currentGrade);
    if (currentGradeIndex === -1) {
        console.warn(`updateUserGrade: User ${loginid} has an invalid grade: ${currentGrade}. Defaulting to F.`);
        return; 
    }

    let newGradeIndex = currentGradeIndex;
    if (increase) {
        newGradeIndex = Math.min(grades.length - 1, currentGradeIndex + 1);
    } else {
        newGradeIndex = Math.max(0, currentGradeIndex - 1);
    }

    if (grades[newGradeIndex] !== currentGrade) {
        await connection.query('UPDATE person SET grade = ? WHERE loginid = ?', [grades[newGradeIndex], loginid]);
        console.log(`User ${loginid} grade updated from ${currentGrade} to ${grades[newGradeIndex]}`);
    }
}

module.exports = {
     // 라벨링 데이터가 포함될 데이터셋을 생성합니다. (관리자용)
    create_dataset: (req, res) => {
        console.log('label.create_dataset invoked');
        const { name, price, content, question, options } = req.body;

        // 디버깅을 위해 받은 데이터 출력
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

        // 1. dataset 테이블에 삽입
        db.query(
            'INSERT INTO dataset (name, price, content, sale_yn, question) VALUES (?, ?, ?, ?, ?)',
            [sanitizedName, sanitizedPrice, sanitizedContent, 'Y', sanitizedQuestion],
            (error, results) => {
                if (error) {
                    console.error('DB Error on create_dataset:', error);
                    return res.status(500).json({ success: false, message: '데이터셋 생성 중 문제가 발생했습니다.' });
                }

                const datasetId = results.insertId;

                // 2. vote_option 테이블에 삽입
                const optionValues = sanitizedOptions.map(option => [datasetId, option]);
                db.query(
                    'INSERT INTO vote_option (dataset_id, content) VALUES ?',
                    [optionValues],
                    (error, results) => {
                        if (error) {
                            console.error('DB Error on inserting options:', error);
                            return res.status(500).json({ success: false, message: '옵션 저장 중 문제가 발생했습니다.' });
                        }

                        console.log(`${sanitizedOptions.length} options inserted for dataset ID: ${datasetId}`);
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
        console.log('label.labelinfo');
        const { datasetid } = req.params;
        if (!datasetid) {
            return res.status(400).json({ success: false, message: 'datasetid 파라미터가 필요합니다.' });
        }
        // finalOption이 NULL인 라벨(아직 최종 결정되지 않은 라벨)만 조회
        db.query(
            'SELECT label_id, source FROM label WHERE dataset_id = ? AND finalOption IS NULL',
            [datasetid],
            (error, results) => {
                if (error) {
                    console.error('DB Error on labelinfo:', error);
                    return res.status(500).json({ success: false, message: '라벨 정보를 불러오는 중 문제가 발생했습니다.' });
                }
                res.status(200).json({
                    success: true,
                    labels: results
                });
            }
        );
    },

    // 특정 데이터셋에 속한 모든 옵션 정보를 가져옵니다.
    get_dataset_options: (req, res) => {
        console.log('label.get_dataset_options invoked');
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
    submit_label: async (req, res) => {
        console.log('label.submit_label invoked to record a vote');
        const { label_id, finalOption } = req.body;
        const loginid = req.session.loginid;

        if (!req.session.is_logined || !loginid) {
            return res.status(401).json({ success: false, message: '로그인이 필요합니다.' });
        }
        if (!label_id || !finalOption) {
            return res.status(400).json({ success: false, message: '라벨 ID와 선택된 옵션은 필수입니다.' });
        }

        let userCid, userGrade;
        try {
            const [userResults] = await db.promise().query('SELECT cid, grade FROM person WHERE loginid = ?', [loginid]);
            if (userResults.length === 0) {
                return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
            }
            userCid = userResults[0].cid;
            userGrade = userResults[0].grade;
        } catch (error) {
            console.error('DB Error on fetching user for vote:', error);
            return res.status(500).json({ success: false, message: '사용자 정보 조회 중 오류 발생' });
        }
        
        let voteInsertId;
        try {
            const [voteResults] = await db.promise().query(
                'INSERT INTO vote (cid, label_id, content, grade, correct) VALUES (?, ?, ?, ?, ?)',
                [userCid, label_id, finalOption, userGrade, 'N/A']
            );
            voteInsertId = voteResults.insertId;
            console.log(`Vote ${voteInsertId} recorded for label_id ${label_id} by user ${loginid}`);

            const [labelMeta] = await db.promise().query('SELECT dataset_id FROM label WHERE label_id = ?', [label_id]);
            if (labelMeta.length === 0) {
                console.error(`Failed to find dataset_id for label_id ${label_id}`);
                return res.status(200).json({
                    success: true,
                    message: '투표는 기록되었으나, 데이터셋 정보를 찾지 못해 자동 집계를 실행할 수 없습니다.',
                    voteId: voteInsertId
                });
            }
            const datasetIdForClosure = labelMeta[0].dataset_id;

            await module.exports.close_voting(datasetIdForClosure, label_id);
            
            res.status(200).json({
                success: true,
                message: '투표가 성공적으로 기록되었고, 집계 처리가 시도되었습니다.',
                voteId: voteInsertId
            });

        } catch (error) {
            console.error('Error during vote submission or closing process:', error);
            if (voteInsertId) {
                 return res.status(500).json({ success: false, message: `투표(ID: ${voteInsertId})는 기록되었으나, 후속 집계 처리 중 오류: ${error.message}`});
            }
            return res.status(500).json({ success: false, message: `투표 기록 또는 집계 처리 중 오류: ${error.message}` });
        }
    },

    // 투표를 종료하고 라벨링 결과를 블록체인에 기록합니다.
    close_voting: async (datasetId, labelId) => {
        console.log(`close_voting called for datasetId: ${datasetId}, labelId: ${labelId}`);
        const VOTE_THRESHOLD = 3; 
        let connection;

        try {
            connection = await db.promise().getConnection();
            await connection.beginTransaction();

            const [labelStatus] = await connection.query('SELECT onchainYn FROM label WHERE label_id = ?', [labelId]);
            if (labelStatus.length > 0 && labelStatus[0].onchainYn === 'Y') {
                console.log(`Label ${labelId} is already processed and onchain. Skipping.`);
                await connection.commit();
                return;
            }

            const [votes] = await connection.query('SELECT COUNT(*) as voteCount FROM vote WHERE label_id = ?', [labelId]);
            const voteCount = votes[0].voteCount;
            console.log(`Votes for label ${labelId}: ${voteCount}`);

            if (voteCount >= VOTE_THRESHOLD) {
                console.log(`Threshold met for label ${labelId}. Processing finalization.`);

                const [voteDetails] = await connection.query(
                    'SELECT v.content, v.cid, p.grade, p.loginid FROM vote v JOIN person p ON v.cid = p.cid WHERE v.label_id = ?', 
                    [labelId]
                );

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
                
                if(finalLabelText === null && voteDetails.length > 0) { 
                    finalLabelText = voteDetails[0].content;
                }

                if (finalLabelText) {
                    await connection.query('UPDATE label SET finalOption = ? WHERE label_id = ?', [finalLabelText, labelId]);
                    console.log(`Label ${labelId} updated with finalOption: ${finalLabelText}`);

                    const [labelSourceInfo] = await connection.query('SELECT source FROM label WHERE label_id = ?', [labelId]);
                    const sourceForBlockchain = labelSourceInfo.length > 0 ? labelSourceInfo[0].source : 'N/A';
                    
                    const blockchainPayload = [{ label_id: labelId, finalOption: finalLabelText, source: sourceForBlockchain }];
                    const blockchainResult = await module.exports.upload_to_blockchain(datasetId, blockchainPayload);

                    if (blockchainResult && blockchainResult.success) {
                        await connection.query('UPDATE label SET onchainYn = \'Y\', onchainHash = ? WHERE label_id = ?', [blockchainResult.hash, labelId]);
                        console.log(`Label ${labelId} marked onchain with hash ${blockchainResult.hash}`);
                    } else {
                        console.error(`Blockchain upload failed for label ${labelId}. Error: ${blockchainResult ? blockchainResult.error : 'Unknown error'}`);
                    }

                    await connection.query('UPDATE vote SET correct = CASE WHEN content = ? THEN \'Y\' ELSE \'N\' END WHERE label_id = ?', [finalLabelText, labelId]);
                    console.log(`Vote correctness updated for label ${labelId}`);
                    
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

                    for (const loginid_key in votersToUpdate) {
                        const { correct, incorrect, loginid: voterLoginId } = votersToUpdate[loginid_key];
                        if (correct > incorrect) {
                            await updateUserGrade(connection, voterLoginId, true);
                        } else if (incorrect > correct) {
                            await updateUserGrade(connection, voterLoginId, false);
                        }
                    }
                    console.log(`User grades updated for voters of label ${labelId}`);
                } else {
                     console.log(`Could not determine finalOption for label ${labelId}. No votes or tie with no clear winner based on current logic.`);
                }
                await connection.commit();
                console.log(`Finalization complete and committed for label ${labelId}`);

            } else {
                console.log(`Threshold not met for label ${labelId}. Current votes: ${voteCount}. No action taken.`);
                await connection.commit(); 
            }
        } catch (error) {
            if (connection) await connection.rollback();
            console.error(`Error in close_voting for label ${labelId}:`, error);
            throw error; 
        } finally {
            if (connection) connection.release();
        }
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
            console.log(`[블록체인 기록] Simulated TxHash: ${dummyHash} for dataset ${datasetId}`);
            return { success: true, hash: dummyHash };
        } catch (err) {
            console.error('블록체인 기록 중 오류:', err);
            return { success: false, error: err.message || 'Blockchain upload failed' };
        }
    }
};