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
                        'SELECT name, class, loginid, grade FROM person WHERE loginid = ? AND password = ?',
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
    register_process: (req, res) => {
        console.log('/api/auth.register_process');
        const { loginid, password, name, address, tel, birth } = req.body;

        // 필수 항목 검증
        if (!loginid || !password || !name || !birth) {
            return res.status(400).json({ success: false, message: '필수 정보를 입력해주세요.' });
        }

        // 입력값 정리 및 필터링
        const sanitizedId = sanitizeHtml(loginid);
        const sanitizedPassword = sanitizeHtml(password);
        const sanitizedName = sanitizeHtml(name);
        const sanitizedAddress = sanitizeHtml(address || '');
        const sanitizedTel = sanitizeHtml(tel || '');
        const sanitizedBirth = sanitizeHtml(birth);

        // 기본값 정의
        const defaultClass = 'CST';
        const defaultGrade = 'B';
        const defaultPoint = 0;

        // DB에 사용자 추가
        db.query(
            `INSERT INTO person (loginid, password, name, address, tel, birth, class, grade, point) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sanitizedId, sanitizedPassword, sanitizedName, sanitizedAddress, sanitizedTel, sanitizedBirth, defaultClass, defaultGrade, defaultPoint],
            (err) => {
                if (err) {
                    console.error('회원가입 오류:', err);
                    return res.status(500).json({ success: false, message: '회원가입 중 문제가 발생했습니다.' });
                }

                // 세션 설정
                req.session.is_logined = true;
                req.session.loginid = sanitizedId;
                req.session.name = sanitizedName;
                req.session.cls = defaultClass; // 기본값 설정
                req.session.grade = defaultGrade; // 기본값 설정
                req.session.point = defaultPoint; // 기본값 설정

                res.status(200).json({ success: true, message: '회원가입 성공!' });
            }
        );
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
