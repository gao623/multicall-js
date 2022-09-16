const Web3 = require('web3');
const TronWeb = require('tronweb');
const { MultiCall } = require("../");

async function multiCall(client, config, multiCallType) {
  console.log("multiCallType", multiCallType)
  const {multiCallAddr, targetInfo} = config;
  const aggregateResult = await MultiCall.aggregate(client, multiCallAddr, targetInfo, {multiCallType: multiCallType});
  console.log("aggregateResult:", aggregateResult.blockNumber, aggregateResult.result);
  const multiRequestResult = await MultiCall[multiCallType](client, multiCallAddr, targetInfo);
  const result = await MultiCall.decodeEthMultiCall(targetInfo, multiRequestResult);
  return result;
}

function getEthClient(nodeUrl) {
  console.log("eth nodeUrl", nodeUrl);
  const web3 = new Web3(new Web3.providers.HttpProvider(nodeUrl));
  return web3;
}

function getTrxClient(nodeUrl, apiKey) {
  console.log("trx nodeUrl", nodeUrl);
  const fullHost = new TronWeb.providers.HttpProvider(nodeUrl);
  const solidityNode = new TronWeb.providers.HttpProvider(nodeUrl);
  const eventServer = new TronWeb.providers.HttpProvider(nodeUrl);

  let tronWeb = new TronWeb({
    fullHost,
    solidityNode,
    eventServer,
    // headers: { "TRON-PRO-API-KEY": 'your api key' },
    // privateKey: 'your private key',
  });

  if (apiKey) {
    tronWeb.setHeader({"TRON-PRO-API-KEY": apiKey});
  }

  tronWeb.customApi = {};
  tronWeb.customApi.checkAddress = (address) => tronWeb.isAddress(address);
  tronWeb.customApi._base58ToHexAddress = (base58Address) => tronWeb.address.toHex(base58Address);
  tronWeb.customApi._hexToBase58Address = (hexAddress) => tronWeb.address.fromHex(hexAddress);
  tronWeb.customApi._hexToEthereumAddress = (hexAddress) => `0x${hexAddress.slice(2, hexAddress.length)}`;
  tronWeb.customApi._ethereumToHexAddress = (ethereumAddress) => `41${TronChain.hexStrip0x(ethereumAddress)}`;
  tronWeb.customApi.checkEthereumAddress = (address) => /^(0x){1}[0-9a-fA-F]{40}$/i.test(address);
  tronWeb.customApi.toHexAddress = (base58Address) => {
    if (tronWeb.customApi.checkEthereumAddress(base58Address)) {
      return tronWeb.customApi._ethereumToHexAddress(base58Address);
    } else if (tronWeb.customApi.checkAddress(base58Address)) {
      return tronWeb.customApi._base58ToHexAddress(base58Address);
    }
    return base58Address;
  }

  tronWeb.customApi.toBase58Address = (hexAddress) => {
    if (tronWeb.customApi.checkEthereumAddress(hexAddress)) {
      return tronWeb.customApi._hexToBase58Address(tronWeb.customApi._ethereumToHexAddress(hexAddress));
    } else if (tronWeb.customApi.checkAddress(hexAddress)) {
      return tronWeb.customApi._hexToBase58Address(hexAddress);
    }
    return hexAddress;
  }

  tronWeb.customApi.toEthereumAddress = (base58Address) => {
    if (tronWeb.customApi.checkAddress(base58Address)) {
      return tronWeb.customApi._hexToEthereumAddress(tronWeb.customApi._base58ToHexAddress(base58Address));
    }
    return base58Address;
  }

  return tronWeb;
}

async function test(config, chainTypeDict) {
  for (let chainType in config) {
    if (chainType === chainTypeDict.TRX) {
      const {nodeUrl, apiKey, multiCallAddr} = config[chainType];
      const client = getTrxClient(nodeUrl, apiKey);
      // console.log(chainType, "client keys", Object.keys(client), client)
      console.log(chainType, multiCallAddr, "is", client.customApi.toEthereumAddress("TDGSR64oU4QDpViKfdwawSiqwyqpUB6JUD"));
      // const result = await multiCall(client, config[chainType], "MultiCall");
      const result = await multiCall(client, config[chainType], "trxMultiCall");
      console.log(chainType, "final result:", result.blockNumber, result.result);
    } else {
      const {nodeUrl} = config[chainType];
      const client = getEthClient(nodeUrl);
      const result = await multiCall(client, config[chainType], "ethMultiCall");
      console.log(chainType, "final result:", result.blockNumber, result.result);
    }
  }
}

const config = {
  WAN: {
    nodeUrl: process.env.testnetWanRpc,
    multiCallAddr: "0x14095a721Dddb892D6350a777c75396D634A7d97",
    targetInfo: [
      {
        address:"0xaa5a0f7f99fa841f410aafd97e8c435c75c22821"
        ,funcName:"getStoremanGroupInfo"
        ,inputTypes:["bytes32"]
        ,outputTypes:[{"components":[{"name":"groupId","type":"bytes32"},{"name":"status","type":"uint8"},{"name":"deposit","type":"uint256"},{"name":"depositWeight","type":"uint256"},{"name":"selectedCount","type":"uint256"},{"name":"memberCount","type":"uint256"},{"name":"whiteCount","type":"uint256"},{"name":"whiteCountAll","type":"uint256"},{"name":"startTime","type":"uint256"},{"name":"endTime","type":"uint256"},{"name":"registerTime","type":"uint256"},{"name":"registerDuration","type":"uint256"},{"name":"memberCountDesign","type":"uint256"},{"name":"threshold","type":"uint256"},{"name":"chain1","type":"uint256"},{"name":"chain2","type":"uint256"},{"name":"curve1","type":"uint256"},{"name":"curve2","type":"uint256"},{"name":"tickedCount","type":"uint256"},{"name":"minStakeIn","type":"uint256"},{"name":"minDelegateIn","type":"uint256"},{"name":"minPartIn","type":"uint256"},{"name":"crossIncoming","type":"uint256"},{"name":"gpk1","type":"bytes"},{"name":"gpk2","type":"bytes"},{"name":"delegateFee","type":"uint256"}],"name":"info","type":"tuple"}]
        ,outputNames:["storemanGroupInfo"]
        ,args:["0x000000000000000000000000000000000000000000000000006465765f303833"]
      }
      ,{
        address:"0x14095a721Dddb892D6350a777c75396D634A7d97"
        ,funcName:"getEthBalance"
        ,inputTypes:["address"]
        ,outputTypes:["uint256"]
        ,outputNames:["balance"]
        ,args:["0x14095a721Dddb892D6350a777c75396D634A7d97"]
      }
      ,{
        address:"0x62dE27e16f6f31d9Aa5B02F4599Fc6E21B339e79"
        ,funcName:"getFee"
        ,inputTypes:[{"components":[{"name":"srcChainID","type":"uint256"},{"name":"destChainID","type":"uint256"}],"name":"param","type":"tuple"}]
        ,outputTypes:[{"components":[{"name":"lockFee","type":"uint256"},{"name":"revokeFee","type":"uint256"}],"name":"fee","type":"tuple"}]
        ,outputNames:["feeDict"]
        ,args:[["0x8057414e","0x8000003c"]]
      }
    ]
  },
  TRX: {
    nodeUrl: process.env.testnetTrxRpc,
    // multiCallAddr: "TSDi2voShhfnG1SsuFDGQ2G7cRZPqreaae", // 0xb2401225f5ec9b4c1014a93edb3cda19afdd9c1b
    multiCallAddr: "0xb2401225f5ec9b4c1014a93edb3cda19afdd9c1b", // 0xb2401225f5ec9b4c1014a93edb3cda19afdd9c1b
    targetInfo: [
      {
        address:"0xb2401225f5ec9b4c1014a93edb3cda19afdd9c1b"
        ,funcName:"getEthBalance"
        ,inputTypes:["address"]
        ,outputTypes:["uint256"]
        ,outputNames:["balance"]
        ,args:["0xb2401225f5ec9b4c1014a93edb3cda19afdd9c1b"] // TSDi2voShhfnG1SsuFDGQ2G7cRZPqreaae
      }
      ,{
        address:"0xb2401225f5ec9b4c1014a93edb3cda19afdd9c1b" // TSDi2voShhfnG1SsuFDGQ2G7cRZPqreaae
        ,funcName:"getEthBalance"
        ,inputTypes:["address"]
        ,outputTypes:["uint256"]
        ,outputNames:["balance"]
        ,args:["0x242aa579f130bf6fea5eac12aa6b846fb8b293ab"] // TDGSR64oU4QDpViKfdwawSiqwyqpUB6JUD
      }
      ,{
        address:"TY1JDH5SJzKSmZvDMVX5ozWWyddqmqKWD9"
        ,funcName:"getFee"
        ,inputTypes:[{"components":[{"name":"srcChainID","type":"uint256"},{"name":"destChainID","type":"uint256"}],"name":"param","type":"tuple"}]
        ,outputTypes:[{"components":[{"name":"lockFee","type":"uint256"},{"name":"revokeFee","type":"uint256"}],"name":"fee","type":"tuple"}]
        ,outputNames:["feeDict"]
        ,args:[["0x800000c3","0x8000003c"]]
      }
    ]
  }
}

const chainTypeDict = Object.keys(config).reduce((reduced, next) => {
  reduced[next] = next;
  return reduced;
}, {})

test(config, chainTypeDict)
