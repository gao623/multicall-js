const Web3 = require('web3');
const TronWeb = require('tronweb');
const { MultiCall } = require("../");

async function multiCall(client, config, multiCallType,
  aggregateFuncName = MultiCall.aggregateFuncNameDict.aggregate,
  includesAllOutputsWithStatus = MultiCall.includesAllOutputsWithStatus
) {
  console.log("multiCallType", multiCallType)
  const {multiCallAddr, targetInfo} = config;
  const aggregateResult = await MultiCall.aggregate(client, multiCallAddr, targetInfo, {multiCallType, aggregateFuncName, includesAllOutputsWithStatus});
  console.log("aggregateResult:", aggregateResult.blockNumber, aggregateResult.result);
  const multiRequestResult = await MultiCall[multiCallType](client, multiCallAddr, targetInfo, {aggregateFuncName});
  const result = await MultiCall.decodeEthMultiCallV2(targetInfo, multiRequestResult, {includesAllOutputsWithStatus});
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

async function test(config, chainTypeDict,
  aggregateFuncName = MultiCall.aggregateFuncNameDict.aggregate,
  includesAllOutputsWithStatus = MultiCall.includesAllOutputsWithStatus
) {
  for (let chainType in config) {
    if (chainType === chainTypeDict.TRX) {
      const {nodeUrl, apiKey, multiCallAddr} = config[chainType];
      const client = getTrxClient(nodeUrl, apiKey);
      // console.log(chainType, "client keys", Object.keys(client), client)
      console.log(chainType, multiCallAddr, "is", client.customApi.toEthereumAddress("TDGSR64oU4QDpViKfdwawSiqwyqpUB6JUD"));
      const result = await multiCall(client, config[chainType], "trxMultiCall", aggregateFuncName, includesAllOutputsWithStatus);
      console.log(chainType, "final result:", result.blockNumber, result.result, includesAllOutputsWithStatus ? result.status : "");
    } else {
      const {nodeUrl} = config[chainType];
      const client = getEthClient(nodeUrl);
      const result = await multiCall(client, config[chainType], "ethMultiCall", aggregateFuncName, includesAllOutputsWithStatus);
      console.log(chainType, "final result:", result.blockNumber, result.result, includesAllOutputsWithStatus ? result.status : "");
    }
  }
}

function getConfig(includesAllOutputsWithStatus) {
  const config = {
    WAN: {
      nodeUrl: process.env.testnetWanRpc,
      multiCallAddr: "0xd74fe1137461ea0afa66d9024d7add7286e7ed0e",
      targetInfo: [
        {
          address:"0xaa5a0f7f99fa841f410aafd97e8c435c75c22821"
          ,funcName:["getStoremanGroupInfo", "getStoremanGroupConfig"]
          ,inputTypes:["bytes32"]
          ,outputTypes:[["bytes", {"components":[{"name":"groupId","type":"bytes32"},{"name":"status","type":"uint8"},{"name":"deposit","type":"uint256"},{"name":"depositWeight","type":"uint256"},{"name":"selectedCount","type":"uint256"},{"name":"memberCount","type":"uint256"},{"name":"whiteCount","type":"uint256"},{"name":"whiteCountAll","type":"uint256"},{"name":"startTime","type":"uint256"},{"name":"endTime","type":"uint256"},{"name":"registerTime","type":"uint256"},{"name":"registerDuration","type":"uint256"},{"name":"memberCountDesign","type":"uint256"},{"name":"threshold","type":"uint256"},{"name":"chain1","type":"uint256"},{"name":"chain2","type":"uint256"},{"name":"curve1","type":"uint256"},{"name":"curve2","type":"uint256"},{"name":"tickedCount","type":"uint256"},{"name":"minStakeIn","type":"uint256"},{"name":"minDelegateIn","type":"uint256"},{"name":"minPartIn","type":"uint256"},{"name":"crossIncoming","type":"uint256"},{"name":"gpk1","type":"bytes"},{"name":"gpk2","type":"bytes"},{"name":"delegateFee","type":"uint256"}],"name":"info","type":"tuple"}]]
          ,outputNames:["storemanGroupInfo"]
          ,args:["0x000000000000000000000000000000000000000000000000006465765f303833"]
        }
        ,{
          address:"0xd74fe1137461ea0afa66d9024d7add7286e7ed0e"
          ,funcName:includesAllOutputsWithStatus?["getTokenBalance","getBalance"]:["getEthBalance1","getEthBalance","getBalance"]
          ,inputTypes:["address"]
          ,outputTypes:["uint256"]
          ,outputNames:["balance"]
          ,args:["0xd74fe1137461ea0afa66d9024d7add7286e7ed0e"]
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
      multiCallAddr: "TDUDJcZiLZRCPSpWXHP6KKqZ2XL3koriw4", // 0x2664B161FA7F6C16AD56A5BD3D1B3231B7166811
      targetInfo: [
        {
          address:"0x2664B161FA7F6C16AD56A5BD3D1B3231B7166811"
          ,funcName:includesAllOutputsWithStatus?["getTokenBalance","getBalance"]:["getEthBalance1","getEthBalance","getBalance"]
          ,inputTypes:["address"]
          ,outputTypes:["uint256"]
          ,outputNames:["balance"]
          ,args:["0x2664B161FA7F6C16AD56A5BD3D1B3231B7166811"] // TDUDJcZiLZRCPSpWXHP6KKqZ2XL3koriw4
        }
        ,{
          address:"0x2664B161FA7F6C16AD56A5BD3D1B3231B7166811" // TDUDJcZiLZRCPSpWXHP6KKqZ2XL3koriw4
          ,funcName:["getEthBalance", "getBalance"]
          ,inputTypes:["address"]
          ,outputTypes:["uint256"]
          ,outputNames:["balance"]
          ,args:["0x242aa579f130bf6fea5eac12aa6b846fb8b293ab"] // TDGSR64oU4QDpViKfdwawSiqwyqpUB6JUD
        }
        ,{
          address:"TY1JDH5SJzKSmZvDMVX5ozWWyddqmqKWD9"
          ,funcName:"getFee"
          ,inputTypes:[{"components":[{"name":"srcChainID","type":"uint256"},{"name":"destChainID","type":"uint256"}],"name":"param","type":"tuple"}]
          ,outputTypes:[[{"components":[{"name":"lockFee","type":"uint256"},{"name":"revokeFee","type":"uint256"}],"name":"fee","type":"tuple"},"bytes"]]
          ,outputNames:["feeDict"]
          ,args:[["0x800000c3","0x8000003c"]]
        }
      ]
    }
  }
  const chainTypeDict = Object.keys(config).reduce((reduced, next) => {
    reduced[next] = next;
    return reduced;
  }, {});
  return {config, chainTypeDict};
}

// var abi = [{"inputs":[{"components":[{"internalType":"address","name":"target","type":"address"},{"internalType":"bytes","name":"callData","type":"bytes"}],"internalType":"structMulticallV2.Call[]","name":"calls","type":"tuple[]"}],"name":"aggregate","outputs":[{"internalType":"uint256","name":"blockNumber","type":"uint256"},{"internalType":"bytes[]","name":"returnData","type":"bytes[]"}],"stateMutability":"view","type":"function"}];
// console.log("before", MultiCall.aggregateFuncNameDict);
// MultiCall.setAbi(abi)
// console.log("after", MultiCall.aggregateFuncNameDict);

const {config: configWithoutStatus, chainTypeDict:chainTypeDictWithoutStatus} = getConfig(false);
const {config, chainTypeDict} = getConfig(true);

test(configWithoutStatus, chainTypeDictWithoutStatus, MultiCall.aggregateFuncNameDict.aggregateWithAll)
test(config, chainTypeDict, MultiCall.aggregateFuncNameDict.aggregateWithAll, true)
