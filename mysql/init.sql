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




CREATE TABLE comment (
    comment_id INT AUTO_INCREMENT PRIMARY KEY, -- 댓글 ID
    board_id INT NOT NULL, -- 댓글이 달린 게시글 ID
    loginid VARCHAR(10) NOT NULL, -- 작성자 ID
    password VARCHAR(20) NOT NULL, -- 댓글 비밀번호
    content TEXT NOT NULL, -- 댓글 내용
    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- 작성 날짜
    FOREIGN KEY (board_id) REFERENCES board(board_id) ON DELETE CASCADE -- 게시글 삭제 시 댓글도 삭제
);

CREATE TABLE dataset (
    dataset_id   INT AUTO_INCREMENT PRIMARY KEY,      -- 데이터셋 고유 ID
    name         VARCHAR(200)    NOT NULL,            -- 데이터셋 이름
    price        INT            NOT NULL,             -- 가격(KRW)
    content      VARCHAR(255),                        -- 설명
    sale_yn      CHAR(1)       NOT NULL DEFAULT 'N',  -- 판매 여부('Y'/'N')
    question     VARCHAR(255)   NOT NULL              -- 라벨링 질문 문구
);

CREATE TABLE label (
    label_id       INT AUTO_INCREMENT PRIMARY KEY,     -- 라벨 아이디
    dataset_id     INT            NOT NULL,            -- 어떤 데이터셋에 대한 최종 라벨인지
    onchainYN      ENUM('Y','N') NOT NULL DEFAULT 'N', -- 온체인 등록 여부
    onchainHash    VARCHAR(66),                        -- 트랜잭션 해시
    source         VARCHAR(255),                       -- 이미지 경로 등(필요 시)
    finalOption    VARCHAR(255),                       -- 최종 라벨링 내용(옵션 텍스트)
    FOREIGN KEY (dataset_id) REFERENCES dataset(dataset_id)
);

CREATE TABLE vote_option (
    option_id      INT AUTO_INCREMENT PRIMARY KEY,     -- 옵션 고유 ID
    dataset_id     INT            NOT NULL,            -- 어떤 데이터셋의 옵션인지
    label_id       INT,                                -- (완전 확정 후)어느 label에 속하는지
    content        VARCHAR(200) NOT NULL,              -- 옵션 텍스트
    FOREIGN KEY (dataset_id) REFERENCES dataset(dataset_id)
);


CREATE TABLE vote (
    vote_id       INT AUTO_INCREMENT PRIMARY KEY,      -- 투표 고유 ID
    cid           INT            NOT NULL,             -- 투표자(person.cid)
    label_id      INT            NOT NULL,             -- 어떤 라벨에 대한 투표인지
    content       VARCHAR(200)   NOT NULL,             -- 선택된 옵션 텍스트
    grade         VARCHAR(10),                         -- 투표자 신뢰도(사후 계산)
    correct       ENUM('Y','N','N/A'),                       -- 정답 여부(사후 계산)
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 투표 시간
    FOREIGN KEY (cid)      REFERENCES person(cid),
    FOREIGN KEY (label_id) REFERENCES label(label_id)
);


CREATE TABLE purchase (
    purchase_id   INT AUTO_INCREMENT PRIMARY KEY,      -- 구매 고유 ID
    dataset_id    INT            NOT NULL,             -- 구매한 데이터셋
    cid           INT            NOT NULL,             -- 구매자(person.cid)
    date          DATETIME DEFAULT CURRENT_TIMESTAMP,  -- 구매 시각
    price         INT,                                 -- 결제 금액
    point         INT,                                 -- 사용한 포인트
    payYN         CHAR(1)       NOT NULL DEFAULT 'N',  -- 결제 여부
    cancel        CHAR(1)       NOT NULL DEFAULT 'N',  -- 취소 여부
    refund        CHAR(1)       NOT NULL DEFAULT 'N',  -- 환불 여부
    transaction_hash VARCHAR(66) NULL,               -- 스마트 컨트랙트 트랜잭션 해시
    FOREIGN KEY (dataset_id) REFERENCES dataset(dataset_id),
    FOREIGN KEY (cid)        REFERENCES person(cid)
);

