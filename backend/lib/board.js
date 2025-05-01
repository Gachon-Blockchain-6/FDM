let db = require('./db');
let sanitizehtml = require('sanitize-html');
const path = require('path');
const { getElementsByTagType } = require('domutils');

function authIsOwner(req, res) {
    let name = 'Guest';
    let login = false;
    let cls = 'NON';
    if (req.session.is_logined) {
        name = req.session.name;
        login = true;
        cls = req.session.cls;
    }
    return { name, login, cls }
}

module.exports = {
    view: (req, res) => {
        console.log('board.view_3');
        let { name, login, cls } = authIsOwner(req, res);
        let sanitized_type_id = 3; // 고정된 게시판 타입 ID
        let pNum = req.query.pNum || 1; // 페이지 번호, 기본값은 1


        let sqlCount = `SELECT COUNT(*) AS total FROM board WHERE type_id = ?`;

        db.query(sqlCount, [sanitized_type_id], (error, countResults) => {
            if (error) {
                console.log(error);
                res.status(500).send('Internal Server Error');
                return;
            }

            let numPerPage = 10; // 페이지당 표시할 게시글 수
            let offs = (pNum - 1) * numPerPage;
            let totalPages = Math.ceil(countResults[0].total / numPerPage);

            db.query(`SELECT b.board_id, b.title, b.date, p.name 
                      FROM board b 
                      INNER JOIN person p ON b.loginid = p.loginid
                      WHERE b.type_id = ? AND b.p_id = 0 
                      ORDER BY date DESC, board_id DESC 
                      LIMIT ? OFFSET ?`,
                [sanitized_type_id, numPerPage, offs], (err, boards) => {
                    if (err) {
                        console.log(err);
                        res.status(500).send('Internal Server Error');
                        return;
                    }

                    if (boards == undefined) {
                        boards = []; // 빈 배열의 길이를 읽는 경우를 방지
                    }

                    let responseData = {
                        boards: boards || [], // 조회된 게시글 목록
                        totalPages: totalPages, // 전체 페이지 수
                        pNum: pNum, // 현재 페이지 번호
                        cls: cls
                    };
                    console.log(responseData);
                    res.json(responseData);
                });
        });
    },
    detail: (req, res) => {
        console.log('board.detail 호출됨');

        // URL에서 게시글 ID 추출
        const boardId = req.params.boardId;

        const { name, loginid, cls } = authIsOwner(req, res); // 로그인 정보 가져오기

        const sql = `SELECT b.board_id, b.title, b.date, b.content, p.name AS writer, b.loginid
                     FROM board b
                     INNER JOIN person p ON b.loginid = p.loginid
                     WHERE b.board_id = ?`;

        db.query(sql, [boardId], (err, results) => {
            if (err) {
                console.error('Error fetching board details:', err);
                res.status(500).send('Internal Server Error');
                return;
            }

            if (results.length === 0) {
                res.status(404).send('게시글을 찾을 수 없습니다.');
                return;
            }

            const board = results[0];
            const isOwner = board.loginid === loginid; // 게시글 작성자인지 확인

            res.json({
                board_id: board.board_id,
                title: board.title,
                date: board.date,
                content: board.content,
                writer: board.writer,
                isOwner, // 작성자인지 여부
                cls, // 사용자 권한
            });
        });

    },

    create: (req, res) => {
        const { name, loginid, cls } = req.session; // 세션에서 사용자 정보 가져오기
        if (!name || !loginid) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }

        res.json({
            name, // 사용자 이름
            loginid, // 로그인 ID
            type_id: 3 // 게시판의 고정된 type_id
        });
    },

    create_process: (req, res) => {
        console.log('board.create_process');

        let post = req.body;

        let sanitized_type_id = 3; // 고정된 type_id
        let sanitized_login_id = sanitizehtml(post.loginid);
        let sanitized_password = sanitizehtml(post.password);
        let sanitized_title = sanitizehtml(post.title);
        let sanitized_content = sanitizehtml(post.content);
        let p_id = 0; // 댓글에 사용할 기능, 현재는 사용 x

        db.query(`INSERT INTO board (type_id, p_id, loginid, password, title, date, content) VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
            [
                sanitized_type_id,
                p_id,
                sanitized_login_id,
                sanitized_password,
                sanitized_title,
                sanitized_content
            ], (err, result) => {

                console.log(result);
                if (err) {
                    console.log(err);
                    res.status(500).send('Internal Server Error');
                    return;
                }
                res.redirect(`/api/board/view`);
            });
    },
    update: (req, res) => {
        console.log('board.update');

        // 요청 데이터에서 boardId와 password 추출
        const { boardId, password } = req.body;

        // 유효성 검사
        if (!boardId || !password) {
            res.status(400).send("잘못된 요청입니다. 게시글 ID와 비밀번호를 제공해야 합니다.");
            return;
        }

        // 데이터베이스에서 게시글 비밀번호 조회
        const sql = `SELECT * FROM board WHERE board_id = ?`;
        db.query(sql, [boardId], (err, results) => {
            if (err) {
                console.error("DB 조회 오류:", err);
                res.status(500).send("서버 오류가 발생했습니다.");
                return;
            }

            if (results.length === 0) {
                res.status(404).send("게시글을 찾을 수 없습니다.");
                return;
            }

            const board = results[0];

            // 비밀번호 비교
            if (board.password === password) {
                // 비밀번호가 일치하면 수정 화면으로 이동
                res.status(200).send("수정 권한 확인됨");
            } else {
                // 비밀번호가 일치하지 않으면 오류 반환
                res.status(403).send("비밀번호가 일치하지 않습니다.");
            }
        });
    },

    update_process: (req, res) => {
        console.log('board.update_process');

        let post = req.body;
        let sanitized_login_id = req.session.loginid;
        let sanitized_board_id = sanitizehtml(post.boardId);
        let sanitized_password = sanitizehtml(post.password);
        let sanitized_title = sanitizehtml(post.title);
        let sanitized_content = sanitizehtml(post.content);


        db.query(
            `UPDATE board 
             SET title = ?, content = ?, loginid = ?, password =?, date = NOW() 
             WHERE board_id = ?`,
            [sanitized_title, sanitized_content, sanitized_login_id, sanitized_password, sanitized_board_id],
            (err, result) => {
                if (err) {
                    console.error("DB 업데이트 오류:", err);
                    res.status(500).send('Internal Server Error');
                    return;
                }

                console.log("게시글 수정 완료:", result);
                res.writeHead(302, { location: `/boardDetail.html?boardId=${sanitized_board_id}` });
                res.end();
            }
        );
    },


    delete_process: (req, res) => {
        console.log('board.delete_process');

        let sanitized_board_id = sanitizehtml(req.params.boardId);


        db.query(`SELECT * FROM board WHERE board_id = ?`, [sanitized_board_id], (err, results) => {
            if (err) {
                console.log(err);
                res.status(500).send('Internal Server Error');
                return;
            }

            let { login, name, cls } = authIsOwner(req, res);

            if (cls == 'MNG' || name == results[0].loginid) {
                db.query(`DELETE FROM board WHERE board_id = ?;`, [sanitized_board_id], (err, result) => {
                    if (err) {
                        console.log(err);
                        res.status(500).send('Internal Server Error');
                        return;
                    }
                    res.writeHead(302, { location: `/boardDetail.html?boardId=${sanitized_board_id}` });
                    res.end();
                });
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <script language="JavaScript" type="text/javascript">
                        alert("비밀번호가 일치하지 않습니다.");
                        setTimeout(() => {
                            location.href = /boardDetail.html?boardId=${sanitized_board_id};
                        }, 1000);
                    </script>`);
            }
        });
    }
};
