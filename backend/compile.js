const path = require('path');
const fs = require('fs');
const solc = require('solc'); // Node.js 모듈 직접 사용

// --- 설정 필요한 부분 ---
const contractFileName = 'FdmDatasetRegistry.sol'; // 컴파일할 실제 .sol 파일 이름
const contractName = 'FdmDatasetRegistry';     // .sol 파일 내의 주 계약 이름
const outputDirectory = __dirname;             // ABI/BIN 파일이 저장될 디렉토리
// --- 설정 끝 ---

const contractPath = path.resolve(__dirname, contractFileName);
if (!fs.existsSync(contractPath)) {
    console.error(`Error: Solidity file not found at ${contractPath}`);
    process.exit(1);
}
const sourceCode = fs.readFileSync(contractPath, 'utf8');

console.log(`Compiling ${contractFileName} using 'solc' Node.js module with EVM version 'london'...`);

const input = {
  language: 'Solidity',
  sources: {
    [contractFileName]: {
      content: sourceCode,
    },
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
    optimizer: {
      enabled: true,
      runs: 200,
    },
    evmVersion: 'london', // EVM 버전을 'london'으로 설정
  },
};

try {
  // solc.compile은 JSON 문자열을 입력으로 받습니다.
  const outputJson = solc.compile(JSON.stringify(input));
  const output = JSON.parse(outputJson);

  let compilationFailed = false;
  if (output.errors) {
    output.errors.forEach((error) => {
      if (error.severity === 'error') {
        console.error(`Compiler Error: ${error.formattedMessage}`);
        compilationFailed = true;
      } else {
        console.warn(`Compiler Warning: ${error.formattedMessage}`);
      }
    });
  }

  if (compilationFailed) {
    console.error('Compilation failed due to errors reported by solc.');
    process.exit(1);
  }

  const contractsOutput = output.contracts && output.contracts[contractFileName];
  if (!contractsOutput) {
    console.error(`Error: No contracts found in solc output for file ${contractFileName}.`);
    process.exit(1);
  }

  const compiledContract = contractsOutput[contractName];
  if (!compiledContract) {
    console.error(`Error: Contract "${contractName}" not found in solc output for ${contractFileName}. Available contracts: ${Object.keys(contractsOutput).join(', ')}`);
    process.exit(1);
  }

  const abi = compiledContract.abi;
  const bytecode = compiledContract.evm.bytecode.object;

  if (!abi || !bytecode) {
    console.error('Error: ABI or bytecode is missing from solc compilation output.');
    process.exit(1);
  }

  const abiFileBaseName = `${contractName}_sol_${contractName}.abi`;
  const binFileBaseName = `${contractName}_sol_${contractName}.bin`;
  
  const abiFilePath = path.resolve(outputDirectory, abiFileBaseName);
  const binFilePath = path.resolve(outputDirectory, binFileBaseName);

  fs.writeFileSync(abiFilePath, JSON.stringify(abi, null, 2));
  console.log(`ABI file saved to ${abiFilePath}`);

  fs.writeFileSync(binFilePath, bytecode);
  console.log(`BIN file saved to ${binFilePath}`);

  console.log('Compilation successful using "solc" Node.js module!');

} catch (error) {
  console.error('Error during "solc" module compilation or file writing:');
  console.error(error);
  process.exit(1);
} 