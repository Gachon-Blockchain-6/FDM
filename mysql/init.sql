-- 데이터베이스 선택
CREATE DATABASE IF NOT EXISTS dockerProject
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_general_ci;

use dockerProject;

-- 기존 테이블 삭제
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS board;
DROP TABLE IF EXISTS comment;

-- 사용자 테이블 정의
CREATE TABLE person (
    cid INT AUTO_INCREMENT PRIMARY KEY, -- 고객 ID
    loginid VARCHAR(10) NOT NULL, -- 로그인 ID
    password VARCHAR(20) NOT NULL, -- 비밀번호
    name VARCHAR(20) NOT NULL, -- 이름
    address VARCHAR(100), -- 주소
    tel VARCHAR(13), -- 전화번호
    birth VARCHAR(8) NOT NULL, -- 생년월일
    class VARCHAR(3) NOT NULL DEFAULT 'CST', -- 기본 class는 CST
    grade VARCHAR(1) NOT NULL DEFAULT 'B', -- 기본 grade는 B
    point INT DEFAULT 0 -- 기본 포인트는 0
);

-- 관리자 계정 초기값 추가
INSERT INTO person (loginid, password, name, address, tel, birth, class, grade, point)
VALUES ('m', 'm', 'manager', 'seoul', '010', '00000000', 'MNG', 'S', 0);



CREATE TABLE board (
   type_id int,
   board_id int NOT NULL AUTO_INCREMENT,
   p_id int,
   loginid varchar(10) NOT NULL,
   password varchar(20),
   title varchar(200) NOT NULL,
   date varchar(50),
   content text,
   PRIMARY KEY (board_id)
); 

INSERT INTO board (type_id, p_id, loginid, password, title, date, content)
VALUES (3, 0, 'm', 'm', 'Notice - Usage Guide', NOW(), 'Feel free to share your thoughts in the free board. This is managed by the administrator.');




-- 댓글 테이블 정의
CREATE TABLE comment (
    comment_id INT AUTO_INCREMENT PRIMARY KEY, -- 댓글 ID
    board_id INT NOT NULL, -- 댓글이 달린 게시글 ID
    loginid VARCHAR(10) NOT NULL, -- 작성자 ID
    password VARCHAR(20) NOT NULL, -- 댓글 비밀번호
    content TEXT NOT NULL, -- 댓글 내용
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 작성 날짜
    FOREIGN KEY (board_id) REFERENCES board(board_id) ON DELETE CASCADE -- 게시글 삭제 시 댓글도 삭제
);
