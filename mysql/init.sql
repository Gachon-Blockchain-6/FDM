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


-- 4. 데이터셋(dataset)
CREATE TABLE dataset (
    datasetid    INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100)  NOT NULL,            -- 데이터셋 이름
    price        DECIMAL(12,2) NOT NULL,            -- 가격
    sale_yn      CHAR(1)       NOT NULL DEFAULT 'N',-- 판매 여부(Y/N)
    content      VARCHAR(255),                      -- 설명(선택)
    onchain_yn   ENUM('Y','N') NOT NULL DEFAULT 'N',-- 온체인 업로드 여부
    onchain_hash CHAR(66)      DEFAULT NULL,        -- 트랜잭션 해시(0x…)
);

-- 5. 라벨(label)
CREATE TABLE label (
    label_id   INT AUTO_INCREMENT PRIMARY KEY,
    datasetid  INT         NOT NULL,
    cid        INT         NOT NULL,                -- 라벨러
    imagePath  VARCHAR(255) NOT NULL,               -- S3·MinIO 경로
    grade      VARCHAR(1)  NOT NULL,                -- 제출 당시 신뢰도
    label      VARCHAR(100) NOT NULL,               -- 라벨 값
    correct    ENUM('Y','N') DEFAULT 'N',           -- 정답/보상 플래그
    FOREIGN KEY (datasetid) REFERENCES dataset(datasetid) ON DELETE CASCADE,
    FOREIGN KEY (cid)       REFERENCES person(cid),
    -- 동일 이미지에 같은 사용자가 여러 번 제출 못 하도록
    CONSTRAINT uq_label_unique UNIQUE (datasetid, imagePath, cid)
);

-- 6. 구매 이력(purchase)
CREATE TABLE purchase (
    purchase_id INT AUTO_INCREMENT PRIMARY KEY,
    datasetid   INT          NOT NULL,
    loginid     VARCHAR(10)  NOT NULL,              -- 구매자
    purchased_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    price       DECIMAL(12,2) NOT NULL,             -- 결제 금액
    point       INT          DEFAULT 0,             -- 사용 포인트
    payYN       CHAR(1)      DEFAULT 'N',
    cancel      CHAR(1)      DEFAULT 'N',
    refund      CHAR(1)      DEFAULT 'N',
    FOREIGN KEY (datasetid) REFERENCES dataset(datasetid) ON DELETE CASCADE,
    FOREIGN KEY (loginid)  REFERENCES person(loginid)
);