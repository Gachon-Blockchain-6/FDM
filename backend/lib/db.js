const mysql = require('mysql');

const db = mysql.createConnection({
  host: process.env.DB_HOST || 'mysql-container', // DB_HOST 환경 변수로 변경
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || 'dockerProject',
  charset: 'utf8mb4', // 문자셋 설정
});

db.connect();
console.log('db connected!');

module.exports = db;