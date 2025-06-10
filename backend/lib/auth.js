const db = require('./db');
const sanitizeHtml = require('sanitize-html');

module.exports = {
    // 로그인 처리
    login_process: (req, res) => {
        console.log('/api/auth.login_process');
        const { loginid, password } = req.body;
        const sanitizedLoginid = sanitizeHtml(loginid);
        const sanitizedPassword = sanitizeHtml(password);

        db.query(
            'SELECT count(*) as num FROM person WHERE loginid = ? AND password = ?',
            [sanitizedLoginid, sanitizedPassword],
            (error, results) => {
                if (error) {
                    console.error('로그인 오류:', error);
                    return res.status(500).json({ success: false, message: '로그인 중 문제가 발생했습니다.' });
                }

                if (results[0].num === 1) {
                    db.query(
                        'SELECT cid, name, class, loginid, grade, address FROM person WHERE loginid = ? AND password = ?',
                        [sanitizedLoginid, sanitizedPassword],
                        (error, result) => {
                            if (error) {
                                console.error('사용자 정보 조회 오류:', error);
                                return res.status(500).json({ success: false, message: '사용자 정보 조회 중 문제가 발생했습니다.' });
                            }

                            req.session.is_logined = true;
                            req.session.loginid = result[0].loginid;
                            req.session.name = result[0].name;
                            req.session.cls = result[0].class;
                            req.session.grade = result[0].grade;
                            req.session.walletAddress = result[0].address;
                            req.session.userDbId = result[0].cid;

                            console.log(`[AUTH_LOGIN] User ${result[0].loginid} logged in. Session set with wallet: ${result[0].address}, userDbId: ${result[0].cid}`);

                            res.status(200).json({ success: true, message: '로그인 성공!' });
                        }
                    );
                } else {
                    req.session.is_logined = false;
                    req.session.name = 'Guest';
                    req.session.cls = 'NON';
                    res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 잘못되었습니다.' });
                }
            }
        );
    },

    logout_process: (req, res) => {
        console.log('/api/auth.logout_process');
        req.session.destroy((err) => {
            if (err) {
                console.error('로그아웃 오류:', err);
            }
            res.redirect('/');
        });
    },

    // 회원가입 처리
    register_process: async (req, res) => {
        console.log('/api/auth.register_process');
        const { loginid, password, name, address, tel, birth } = req.body;

        // web3 및 계약 인스턴스, 배포자 계정 가져오기
        const web3 = req.app.get('web3');
        const contractInstance = req.app.get('contractInstance');
        // deployerAccountAddress는 main.js에서 app.set으로 설정되었거나, 환경 변수에서 가져옵니다.
        const deployerAccountAddress = req.app.get('deployerAccountAddress');

        if (!web3 || !contractInstance || !deployerAccountAddress) {
            console.error('[AUTH_REGISTER] Web3, 계약 인스턴스 또는 배포자 계정 주소를 서버 설정에서 찾을 수 없습니다.');
            return res.status(500).json({ success: false, message: '서버 내부 설정 오류로 회원가입을 처리할 수 없습니다.' });
        }

        // 필수 항목 검증 (address가 지갑 주소이므로 필수로 간주)
        if (!loginid || !password || !name || !birth || !address) {
            return res.status(400).json({ success: false, message: '필수 정보를 모두 입력해주세요 (아이디, 비밀번호, 이름, 생년월일, 지갑 주소).' });
        }

        // 지갑 주소 유효성 검사 (req.body.address가 지갑 주소)
        if (!web3.utils.isAddress(address)) {
            return res.status(400).json({ success: false, message: '입력된 지갑 주소가 유효하지 않습니다.' });
        }

        // 입력값 정리 및 필터링
        const sanitizedLoginId = sanitizeHtml(loginid);
        const sanitizedPassword = sanitizeHtml(password);
        const sanitizedName = sanitizeHtml(name);
        const sanitizedWalletAddress = sanitizeHtml(address); // address 필드를 지갑 주소로 사용 및 sanitize
        const sanitizedTel = sanitizeHtml(tel || '');
        const sanitizedBirth = sanitizeHtml(birth);

        // 기본값 정의
        const defaultClass = 'CST';
        const defaultGrade = 'B'; // 초기 등급
        const defaultPoint = 0;

        // 등급을 신뢰도 점수로 변환 (스마트 계약의 User.trust 필드에 맞게)
        const gradeToTrustScore = (grade) => {
            if (grade === 'A') return 90;
            if (grade === 'B') return 70; // 'B' 등급은 신뢰도 70으로 매핑
            if (grade === 'C') return 50;
            return 60; // 기타 등급 또는 기본 신뢰도
        };
        const initialTrust = gradeToTrustScore(defaultGrade);
        const initialBalance = 1000; // 스마트 계약에 등록할 초기 가천코인 잔액

        // DB에 사용자 추가 (Promise 사용을 위해 new Promise로 감쌈)
        new Promise((resolve, reject) => {
            // person 테이블의 'address' 컬럼에 지갑 주소를 저장한다고 가정
            db.query(
                `INSERT INTO person (loginid, password, name, address, tel, birth, class, grade, point) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [sanitizedLoginId, sanitizedPassword, sanitizedName, sanitizedWalletAddress, sanitizedTel, sanitizedBirth, defaultClass, defaultGrade, defaultPoint],
                (err, results) => {
                    if (err) {
                        console.error('DB 회원가입 오류:', err);
                        // loginid 중복 등의 오류를 클라이언트에게 좀 더 명확히 전달할 수 있음 (err.code 확인 등)
                        return reject({ status: 500, message: '회원가입 중 DB 오류가 발생했습니다: ' + err.message });
                    }
                    if (!results || !results.insertId) {
                        console.error('DB 회원가입 오류: DB에서 사용자 ID(insertId)를 가져올 수 없습니다.');
                        return reject({ status: 500, message: '회원가입 처리 중 오류가 발생했습니다 (사용자 ID 없음).' });
                    }
                    resolve(results.insertId); // 성공 시 새로 생성된 사용자의 ID (PK) 반환
                }
            );
        })
        .then(async (userDbId) => {
            const cid = userDbId; // DB의 PK를 스마트 계약의 cid로 사용

            console.log(`[BC_REGISTER] 스마트 계약 registerUser 호출 시도: cid=${cid}, wallet=${sanitizedWalletAddress}, balance=${initialBalance}, trust=${initialTrust}`);
            
            try {
                // 가스량 예측 (선택적이지만 권장)
                // const estimatedGas = await contractInstance.methods.registerUser(cid, sanitizedWalletAddress, initialBalance, initialTrust).estimateGas({ from: deployerAccountAddress });

                // 현재 가스 가격 조회
                const currentGasPrice = await web3.eth.getGasPrice();
                console.log(`[BC_REGISTER] Current gas price: ${currentGasPrice}`);

                // 스마트 계약 registerUser 함수 호출
                const receipt = await contractInstance.methods.registerUser(cid, sanitizedWalletAddress, initialBalance, initialTrust).send({
                    from: deployerAccountAddress, // 트랜잭션 발신자 (서버의 관리 계정, 가스비 지불)
                    gas: '600000', // 충분한 가스량 설정 (위의 estimateGas 결과 사용 권장)
                    gasPrice: currentGasPrice // EIP-1559 오류 방지를 위해 gasPrice 명시
                });
                console.log('[BC_REGISTER] 스마트 계약 사용자 등록 성공. 트랜잭션 해시:', receipt.transactionHash);

                // 세션 설정
                req.session.is_logined = true;
                req.session.loginid = sanitizedLoginId;
                req.session.name = sanitizedName;
                req.session.cls = defaultClass;
                req.session.grade = defaultGrade;
                req.session.point = defaultPoint;
                req.session.walletAddress = sanitizedWalletAddress; // 지갑 주소도 세션에 저장
                req.session.userDbId = userDbId; // DB ID (cid)도 세션에 저장

                res.status(200).json({ 
                    success: true, 
                    message: '회원가입 및 블록체인 사용자 등록 성공!', 
                    user: { loginid: sanitizedLoginId, name: sanitizedName, walletAddress: sanitizedWalletAddress, cid: cid },
                    transactionHash: receipt.transactionHash 
                });

            } catch (contractError) {
                console.error('[BC_REGISTER] 스마트 계약 사용자 등록 실패:', contractError);
                // 중요: DB 트랜잭션은 이미 커밋되었으므로, 여기서 DB 롤백 로직을 고려해야 할 수 있습니다.
                // 예: 사용자를 다시 삭제하거나, '블록체인 등록 실패' 상태로 표시 등.
                // db.query('DELETE FROM person WHERE id = ?', [userDbId], (rollbackErr) => { ... });
                return res.status(500).json({ 
                    success: false, 
                    message: 'DB에 회원가입은 성공했으나, 블록체인에 사용자 정보를 등록하는 중 오류가 발생했습니다.',
                    db_success: true, 
                    bc_error: contractError.message 
                });
            }
        })
        .catch(dbError => {
            // db.query에서 reject된 오류 처리
            res.status(dbError.status || 500).json({ success: false, message: dbError.message });
        });
    },

    // 익명 로그인 처리
    proxy_login: (req, res) => {
        req.session.is_logined = true;
        req.session.loginid = 'Guest';
        req.session.name = 'Guest';
        req.session.cls = 'proxy';
        req.session.grade = 'proxy';

        res.status(200).json({ success: true, message: '익명 로그인 성공' });
    },
};
