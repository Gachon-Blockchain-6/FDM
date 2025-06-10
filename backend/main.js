const express = require('express');
const session = require('express-session');
const MysqlStore = require('express-mysql-session')(session);
const bodyparser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./router/apidocs.auto.json');
const Web3 = require('web3').default;
const fs = require('fs');
const path = require('path');
const Minio = require('minio');

const authRouter = require('./router/authRouter');
const rootRouter = require('./router/rootRouter');
const boardRouter = require('./router/boardRouter');
const uploadRouter = require('./router/uploadRouter');
const labelRouter = require('./router/labelRouter');

// 세션 DB 정의
const options = {
    host: process.env.DB_HOST || 'mysql-container', 
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_DATABASE || 'dockerProject',
    createDatabaseTable: true,
    charset: 'utf8mb4'  // 문자셋 추가
};

const sessionStore = new MysqlStore(options);

const app = express();


const GETH_RPC_URL = process.env.GETH_RPC_URL || 'http://geth-node1:8545'; // docker-compose.yaml의 geth-node1 서비스 사용
const DEPLOYER_ACCOUNT_ADDRESS = "0x03c11379de6df7465227492e26a0c958106804c8" // geth-node1 hardcoding
const DEPLOYER_ACCOUNT_PASSWORD ="3238"; // 비밀번호가 없다면 빈 문자열


const ABI_FILE_PATH = path.join(__dirname, 'FdmDatasetRegistry_sol_FdmDatasetRegistry.abi');
const BIN_FILE_PATH = path.join(__dirname, 'FdmDatasetRegistry_sol_FdmDatasetRegistry.bin');
const CONTRACT_ADDRESS_FILE_PATH = path.join(__dirname, 'deployed_contract_address.txt');

let deployedContractAddress = null; // 배포된 계약 주소를 저장할 변수 (애플리케이션 전역에서 사용 가능)
let fdmDatasetRegistryInstance = null; // 배포된 계약 인스턴스를 저장할 변수

// MinIO 클라이언트 설정 (스마트 계약 초기화 전 또는 후에 위치 가능)
try {
    const minioClient = new Minio.Client({
        endPoint: process.env.MINIO_ENDPOINT || 'image-container',
        port: parseInt(process.env.MINIO_PORT) || 9000,
        useSSL: process.env.MINIO_USE_SSL === 'true', // 문자열 'true'와 비교
        accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        // pathStyle: true // MinIO 설정 및 uploadRouter.js의 설정에 따라 이 옵션이 필요할 수 있습니다.
                           // uploadRouter.js에는 pathStyle: true 가 있었으므로, 일관성을 위해 추가하는 것을 고려할 수 있습니다.
                           // 여기서는 일단 생략하고, 필요시 추가합니다.
    });
    app.set('minioClient', minioClient);
    console.log('[MAIN_SETUP] MinIO client initialized and set in app.');

    const bucketName = process.env.MINIO_BUCKET_NAME || 'uploads';
    app.set('minioBucketName', bucketName);
    console.log(`[MAIN_SETUP] MinIO bucket name set in app: ${bucketName}`);

    minioClient.bucketExists(bucketName, (err, exists) => {
        if (err) {
            return console.error('[MINIO_SETUP_ERROR] Error checking bucket:', bucketName, err);
        }
        if (!exists) {
            minioClient.makeBucket(bucketName, (makeErr) => { // region 파라미터는 MinIO 버전에 따라 다를 수 있음
                if (makeErr) {
                    return console.error('[MINIO_SETUP_ERROR] Error creating bucket:', bucketName, makeErr);
                }
                console.log(`[MINIO_SETUP] Bucket '${bucketName}' created successfully.`);
            });
        } else {
            console.log(`[MINIO_SETUP] Bucket '${bucketName}' already exists.`);
        }
    });

} catch (minioSetupError) {
    console.error("[MAIN_SETUP_ERROR] Failed to initialize MinIO client:", minioSetupError);
    // MinIO 클라이언트 초기화 실패는 심각한 문제일 수 있으므로, 필요시 process.exit(1) 고려
}

async function initializeContract(app) {
    console.log(`[BC] FdmDatasetRegistry 스마트 계약 초기화를 시도합니다... (Geth RPC: ${GETH_RPC_URL})`);
    const web3 = new Web3(GETH_RPC_URL);
    app.set('web3', web3); // web3 인스턴스 먼저 저장

    let abi;
    try {
        if (!fs.existsSync(ABI_FILE_PATH)) {
            console.error(`[BC] ABI 파일을 찾을 수 없습니다: ${ABI_FILE_PATH}`);
            return; // ABI 파일 없이는 진행 불가
        }
        abi = JSON.parse(fs.readFileSync(ABI_FILE_PATH, 'utf8'));
    } catch (error) {
        console.error(`[BC] ABI 파일(${ABI_FILE_PATH})을 읽는 중 오류 발생:`, error.message);
        return;
    }

    let existingAddress = null;
    try {
        if (fs.existsSync(CONTRACT_ADDRESS_FILE_PATH)) {
            existingAddress = fs.readFileSync(CONTRACT_ADDRESS_FILE_PATH, 'utf8').trim();
            if (!web3.utils.isAddress(existingAddress)) {
                console.warn(`[BC] ${CONTRACT_ADDRESS_FILE_PATH} 파일에 유효하지 않은 주소가 있습니다: ${existingAddress}. 새로 배포합니다.`);
                existingAddress = null;
            } else {
                const code = await web3.eth.getCode(existingAddress); // 이 부분은 비동기로 유지 (web3 호출)
                if (code === '0x' || code === '0x0') {
                    console.warn(`[BC] ${existingAddress} 주소에 배포된 코드가 없습니다. 새로 배포합니다.`);
                    existingAddress = null;
                }
            }
        } else {
            console.log(`[BC] ${CONTRACT_ADDRESS_FILE_PATH} 파일을 찾을 수 없습니다. 새로 배포합니다.`);
        }
    } catch (error) {
        console.error(`[BC] ${CONTRACT_ADDRESS_FILE_PATH} 파일 처리 중 오류:`, error);
        existingAddress = null; // 오류 발생 시 안전하게 새로 배포하도록 처리
    }

    if (existingAddress) {
        console.log(`[BC] 기존 계약 주소 ${existingAddress}를 사용합니다.`);
        const contractInstance = new web3.eth.Contract(abi, existingAddress);
        app.set('contractAddress', existingAddress);
        app.set('contractInstance', contractInstance);
        app.set('deployerAccountAddress', DEPLOYER_ACCOUNT_ADDRESS);
        console.log(`[BC] 기존 FdmDatasetRegistry 스마트 계약 인스턴스가 설정되었습니다. 주소: ${existingAddress}`);
    } else {
        console.log('[BC] 새로 스마트 계약을 배포합니다.');
        if (!DEPLOYER_ACCOUNT_ADDRESS) {
            console.error('[BC] DEPLOYER_ACCOUNT_ADDRESS가 설정되지 않아 새 계약을 배포할 수 없습니다.');
            return;
        }

        let bytecode;
        try {
            if (!fs.existsSync(BIN_FILE_PATH)) {
                console.error(`[BC] BIN 파일을 찾을 수 없습니다: ${BIN_FILE_PATH}`);
                return; // BIN 파일 없이는 배포 불가
            }
            bytecode = '0x' + fs.readFileSync(BIN_FILE_PATH, 'utf8');
        } catch (error) {
            console.error(`[BC] BIN 파일(${BIN_FILE_PATH})을 읽는 중 오류 발생:`, error.message);
            return;
        }

        try {
            // web3.eth.getAccounts() 등 web3 관련 호출은 비동기로 유지됩니다.
            const accounts = await web3.eth.getAccounts();
            console.log('[BC] Geth Accounts List from app:', accounts);
            if (accounts.length === 0 && !DEPLOYER_ACCOUNT_ADDRESS) {
                console.error('[BC] Geth 노드에 사용 가능한 계정이 없고, DEPLOYER_ACCOUNT_ADDRESS도 설정되지 않았습니다.');
                return;
            }

            const deployerAccount = DEPLOYER_ACCOUNT_ADDRESS;
            console.log(`[BC] 배포에 사용할 계정: ${deployerAccount}`);

            try {
                await web3.eth.personal.unlockAccount(deployerAccount, DEPLOYER_ACCOUNT_PASSWORD, 600);
                console.log(`[BC] 계정 ${deployerAccount} 잠금 해제 성공.`);
            } catch (unlockError) {
                console.error(`[BC] 계정 ${deployerAccount} 잠금 해제 실패: ${unlockError.message}`);
                return;
            }
            
            const balanceWei = await web3.eth.getBalance(deployerAccount);
            const balanceEther = web3.utils.fromWei(balanceWei, 'ether');
            console.log(`[BC] 배포 계정 (${deployerAccount}) 잔액: ${balanceEther} ETH`);
            if (parseFloat(balanceEther) === 0) {
                console.warn('[BC] 배포 계정의 잔액이 0 ETH 입니다. 가스비가 부족하여 배포에 실패할 수 있습니다.');
            }

            const FdmContract = new web3.eth.Contract(abi);
            console.log('[BC] 계약 배포 트랜잭션 전송 중...');
            const gasEstimate = await FdmContract.deploy({ data: bytecode }).estimateGas({ from: deployerAccount });
            console.log(`[BC] 예상 가스 사용량: ${gasEstimate}`);
            const gasPrice = await web3.eth.getGasPrice();
            console.log(`[BC] 현재 가스 가격: ${gasPrice} wei`);

            const newInstance = await FdmContract.deploy({
                data: bytecode,
            }).send({
                from: deployerAccount,
                gas: gasEstimate + BigInt(200000 > Number(gasEstimate) * 0.1 ? 200000 : Math.floor(Number(gasEstimate) * 0.1)),
                gasPrice: gasPrice
            })
            .on('error', function(error){ 
                console.error('[BC] 계약 배포 중 오류 발생:', error);
             })
            .on('transactionHash', function(transactionHash){ 
                console.log(`[BC] 계약 배포 트랜잭션 해시: ${transactionHash}`);
             })
            .on('receipt', function(receipt){
               console.log(`[BC] 계약 배포 영수증 수신. 계약 주소 (영수증): ${receipt.contractAddress}`);
            });

            if (newInstance && newInstance.options.address) {
                const newAddress = newInstance.options.address;
                console.log(`[BC] FdmDatasetRegistry 스마트 계약이 성공적으로 배포되었습니다! 주소: ${newAddress}`);
                try {
                    fs.writeFileSync(CONTRACT_ADDRESS_FILE_PATH, newAddress, 'utf8'); // 동기 파일 쓰기
                    console.log(`[BC] 새 계약 주소 ${newAddress}를 ${CONTRACT_ADDRESS_FILE_PATH}에 저장했습니다.`);
                } catch (writeError) {
                    console.error(`[BC] ${CONTRACT_ADDRESS_FILE_PATH} 파일에 새 계약 주소 저장 실패:`, writeError);
                }
                app.set('contractAddress', newAddress);
                app.set('contractInstance', newInstance);
                app.set('deployerAccountAddress', deployerAccount);
            } else {
                console.error('[BC] 계약 배포 후 인스턴스 또는 주소를 가져오는 데 실패했습니다.');
            }
        } catch (deployError) {
            console.error('[BC] 새 스마트 계약 배포 중 예기치 않은 오류 발생:', deployError);
        }
    }
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'Fine Data Mine VeRsIoN0.0',
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
    cookie: {
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}));

app.use(bodyparser.urlencoded({ extended: true }));
app.use(bodyparser.json());

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '../frontend')));

// 라우터 등록
app.use('/api', rootRouter);
app.use('/api/auth', authRouter); 
app.use('/api/board', boardRouter);
app.use('/api/image', uploadRouter);  
app.use('/api/label', labelRouter);

// Swagger UI 설정
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/favicon.ico', (req, res) => res.writeHead(404));

// 기본 HTML 파일 제공 (루트 경로) - frontend 폴더의 index.html을 제공하도록 수정
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// 사용자 등록 확인 함수 정의
async function checkUserRegistration(cidToCheck, appInstance) {
    const contractInstance = appInstance.get('contractInstance');
    if (!contractInstance) {
        console.log(`[USER_CHECK] contractInstance를 찾을 수 없어 사용자 CID ${cidToCheck} 등록 상태를 확인할 수 없습니다.`);
        return false;
    }
    try {
        console.log(`[USER_CHECK] 스마트 계약에서 사용자 CID ${cidToCheck} 정보 조회 시도...`);
        const user = await contractInstance.methods.users(cidToCheck).call();
        // console.log(`[USER_CHECK] User data for CID ${cidToCheck} from contract:`, user); // 상세 정보 로깅 (필요시 활성화)
        if (user && user.wallet !== '0x0000000000000000000000000000000000000000') {
            console.log(`[USER_CHECK] 사용자 CID ${cidToCheck}은(는) 스마트 계약에 등록되어 있습니다. 지갑 주소: ${user.wallet}`);
            return true;
        } else {
            console.log(`[USER_CHECK] 사용자 CID ${cidToCheck}은(는) 스마트 계약에 등록되어 있지 않습니다 (지갑 주소가 address(0) 이거나 사용자 정보 없음).`);
            return false;
        }
    } catch (error) {
        console.error(`[USER_CHECK] 사용자 CID ${cidToCheck}의 등록 상태 확인 중 오류 발생:`, error.message);
        if (error.message && error.message.includes("Returned values aren't valid, did it run Out of Gas?")) {
            console.error("[USER_CHECK] 'Out of Gas' 관련 오류일 수 있습니다. Geth 노드의 상태 및 계약 주소의 유효성을 확인하세요.");
        } else if (error.data === '0x') {
             console.error("[USER_CHECK] '0x' 데이터 반환. 계약이 해당 주소에 존재하지 않거나, 호출하려는 함수가 존재하지 않을 수 있습니다.");
        }
        return false;
    }
}

// 서버 시작 로직 (기존과 동일)
async function startServer() {
    await initializeContract(app); // 계약 초기화 먼저 실행

    app.listen(3000, async () => {
        console.log('http://127.0.0.1:3000/! 서버가 시작되었습니다.');
        const contractAddress = app.get('contractAddress');
        const contractInstance = app.get('contractInstance');

        if (contractAddress) {
            console.log(`[BC] 현재 사용 중인 FdmDatasetRegistry 계약 주소: ${contractAddress}`);
            if (contractInstance) {
                // console.log("[DEBUG] contractInstance가 존재합니다.");
            } else {
                console.warn("[DEBUG] contractInstance가 app에 설정되지 않았습니다.");
            }
        } else {
            console.warn('[BC] FdmDatasetRegistry 계약이 설정되지 않았거나 주소를 가져올 수 없습니다.');
        }
    });
}

startServer().catch(error => {
    console.error('[SERVER_STARTUP_ERROR] 서버 시작 중 오류 발생:', error);
    process.exit(1); 
});
