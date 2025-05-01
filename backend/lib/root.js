const db = require('./db');
const sanitizeHtml = require('sanitize-html');

authIsOwner = (req, res) => {
    var name = 'Guest';
    var login = false;
    var cls = 'NON';
    if (req.session.is_logined) {
        name = req.session.name;
        login = true;
        cls = req.session.cls;
    }
    return { name, login, cls };
};

module.exports = {
    userinfo: (req, res) => {
        console.log('api.userinfo');
        
        // 세션에 로그인된 사용자가 있는지 확인
        const loginid = req.session?.loginid;

        if (!loginid) {
            return res.json({
                point: 0,
                grade: "N/A",
                class: "N/A",
                name: 'GUEST'
            });
        }
        
        // 프록시 사용자 처리
        if(loginid == 'Guest'){
            return res.json({
                point: 0,
                grade: "N/A",
                class: "N/A",
                name: 'GUEST'
            });
        }

        // 데이터베이스에서 사용자 정보 조회
        const sanitized_loginid = sanitizeHtml(loginid);
        const query = `SELECT * FROM person WHERE loginid = ?`;

        db.query(query, [sanitized_loginid], (error, results) => {
            if (error) {
                console.error("사용자 정보 조회 오류:", error);
                return res.status(500).json({ error: "서버 오류로 정보를 가져오지 못했습니다." });
            }

            if (results.length === 0) {
                return res.json({
                    point: 0,
                    grade: "N/A",
                    class: "N/A",
                    name: 'GUEST'
                });
            }

            // 사용자 정보 반환
            const { point, grade, class: userClass, name } = results[0];

            res.json({
                name: name || "N/A",
                point: point || 0,
                grade: grade || "N/A",
                class: userClass || "N/A"
            });
        });
    },
};
