const web3EthAbi = require("web3-eth-abi");
const BaseMultiCall = require("./baseMultiCall");

class MultiCall extends BaseMultiCall {
  static makeEthCallData(targetInfo, options) {
    options = Object.assign({}, {aggregateFuncName: MultiCall.defaultAggregateFuncName}, options);
    const aggregateFuncName = options.aggregateFuncName || MultiCall.defaultAggregateFuncName;
    const multiTargetCallData = MultiCall.makeTargetCallData(targetInfo);
    const abiEncodedData = web3EthAbi.encodeFunctionCall({
      name: MultiCall.aggregateFuncInfo.funcNameDict[aggregateFuncName],
      inputs: MultiCall.aggregateFuncInfo.inputTypes[[aggregateFuncName]]
    }, [multiTargetCallData]);
    return abiEncodedData;
  }

  static async ethCall(web3, multiCallAddress, abiEncodedData, options) {
    options = Object.assign({}, {aggregateFuncName: MultiCall.defaultAggregateFuncName}, options);
    const aggregateFuncName = options.aggregateFuncName || MultiCall.defaultAggregateFuncName;
    const outputTypes = MultiCall.aggregateFuncInfo.outputTypes[aggregateFuncName];

    const returnData = await web3.eth.call({
      to: multiCallAddress,
      data: abiEncodedData
    });
    const multiCallResultsDecodedDict = web3EthAbi.decodeParameters(outputTypes, returnData);

    let multiCallResultsDecoded = [];
    for (let i = 0; i < multiCallResultsDecodedDict.__length__; ++i) {
      multiCallResultsDecoded.push(multiCallResultsDecodedDict[i]);
    }
    const retBlockNumber = multiCallResultsDecoded.shift();
    const retData = multiCallResultsDecoded.shift();
    const retStatus = multiCallResultsDecoded.shift();
    return {
      blockNumber: retBlockNumber,
      returnData: retData,
      returnStatus: retStatus,
    }
  }

  static async trxCall(tronWeb, multiCallAddress, targetCallData, options) {
    options = Object.assign({}, {aggregateFuncName: MultiCall.defaultAggregateFuncName}, options);
    const aggregateFuncName = options.aggregateFuncName || MultiCall.defaultAggregateFuncName;

    const contract = await tronWeb.contract(MultiCall.aggregateAbi, multiCallAddress);
    let retData = await contract[aggregateFuncName](targetCallData).call();
    let result = {
      blockNumber: retData.blockNumber.toString(),
      returnData: retData.returnData
    };
    if (retData.returnStatus) {
      result.returnStatus = retData.returnStatus
    }
    return result
  }

  static async ethMultiCall(web3, multiCallAddress, targetInfo, options) {
    const abiEncodedData = MultiCall.makeEthCallData(targetInfo, options)
    const returnData = await MultiCall.ethCall(web3, multiCallAddress, abiEncodedData, options);
    return returnData;
  }

  static async trxMultiCall(tronWeb, multiCallAddress, targetInfo, options) {
    const checkEthereumAddress = (address) => /^(0x){1}[0-9a-fA-F]{40}$/i.test(address);
    const hexStrip0x = (str) => str.replace(/^0x/, '');
    if (checkEthereumAddress(multiCallAddress)) {
      multiCallAddress = tronWeb.address.fromHex(`41${hexStrip0x(multiCallAddress)}`);
    }
    const abiEncodedData = MultiCall.makeTargetCallData(targetInfo)
    if (!tronWeb.defaultAddress.hex) {
      tronWeb.setAddress(multiCallAddress);
    }
    const returnData = await MultiCall.trxCall(tronWeb, multiCallAddress, abiEncodedData, options);
    return returnData;
  }

  static multiCallTypeDict = {
    ethMultiCall: "ethMultiCall"
    ,trxMultiCall: "trxMultiCall"
  };

  static includesAllOutputsWithStatus = false;
  static aggregateAbi = [{"inputs":[{"components":[{"internalType":"address","name":"target","type":"address"},{"internalType":"bytes","name":"callData","type":"bytes"}],"internalType":"structMulticallV2.Call[]","name":"calls","type":"tuple[]"}],"name":"aggregate","outputs":[{"internalType":"uint256","name":"blockNumber","type":"uint256"},{"internalType":"bytes[]","name":"returnData","type":"bytes[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"target","type":"address"},{"internalType":"bytes","name":"callData","type":"bytes"}],"internalType":"structMulticallV2.Call[]","name":"calls","type":"tuple[]"}],"name":"aggregateWithAll","outputs":[{"internalType":"uint256","name":"blockNumber","type":"uint256"},{"internalType":"bytes[]","name":"returnData","type":"bytes[]"},{"internalType":"bool[]","name":"returnStatus","type":"bool[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"components":[{"internalType":"address","name":"target","type":"address"},{"internalType":"bytes","name":"callData","type":"bytes"}],"internalType":"structMulticallV2.Call[]","name":"calls","type":"tuple[]"}],"name":"aggregateWithStatus","outputs":[{"internalType":"uint256","name":"blockNumber","type":"uint256"},{"internalType":"bytes[]","name":"returnData","type":"bytes[]"},{"internalType":"bool[]","name":"returnStatus","type":"bool[]"}],"stateMutability":"view","type":"function"}];
  static aggregateFuncInfo = MultiCall.__updateAggregateFuncInfo(MultiCall.aggregateAbi);
  static aggregateFuncNameDict = MultiCall.aggregateFuncInfo.funcNameDict;
  static defaultAggregateFuncName = MultiCall.aggregateFuncInfo.funcNameDict.aggregate;

  static setAbi(abi) {
    MultiCall.aggregateAbi = abi;
    MultiCall.aggregateFuncInfo = MultiCall.__updateAggregateFuncInfo(MultiCall.aggregateAbi);
    MultiCall.aggregateFuncNameDict = MultiCall.aggregateFuncInfo.funcNameDict;
    MultiCall.defaultAggregateFuncName = MultiCall.aggregateFuncInfo.funcNameDict.aggregate;
  }

  static async aggregate(client, multiCallAddress, targetInfo, options) {
    const inputTargetInfo = targetInfo.reduce((reduced, info) => {
      if (info) {
        if (Array.isArray(info.inputTypes) && info.inputTypes.length) {
          info.inputTypes = MultiCall.formatFuncInputTypes(info.inputTypes);
        }
        reduced.push(info);
      }
      return reduced;
    }, []);
    if (!inputTargetInfo || !Array.isArray(inputTargetInfo) || !inputTargetInfo.length) {
      throw new Error("invalid targetInfo");
    }
    options = MultiCall.__parseOptions(options);
    const { multiCallType, aggregateFuncName } = options;
    if (!MultiCall.multiCallTypeDict[multiCallType]) {
      throw new Error(`invalid multiCallType "${multiCallType}", it should be one of [${Object.values(MultiCall.multiCallTypeDict)}]`);
    }
    if (!MultiCall.aggregateFuncNameDict[aggregateFuncName]) {
      throw new Error(`invalid aggregateFuncName "${aggregateFuncName}", it should be one of [${Object.values(MultiCall.aggregateFuncNameDict)}]`);
    }
    const multiRequestResult = await MultiCall[multiCallType](client, multiCallAddress, inputTargetInfo, options);
    const result = MultiCall.decodeEthMultiCallV2(inputTargetInfo, multiRequestResult, options);
    return result;
  }

  static __updateAggregateFuncInfo(abi) {
    return abi.reduce((reduced, json) => {
      if (json.type === "function" && json.name && json.name.startsWith("aggregate")) {
        reduced.funcNameDict[json.name] = json.name;
        reduced.inputTypes[json.name] = json.inputs;
        reduced.outputTypes[json.name] = json.outputs;
      }
      return reduced;
    },{outputTypes:{}, inputTypes:{}, funcNameDict:{}});
  }

  static __parseOptions(options) {
    return Object.assign({}, {
      multiCallType: MultiCall.multiCallTypeDict.ethMultiCall,
      aggregateFuncName: MultiCall.defaultAggregateFuncName,
      includesAllOutputsWithStatus: MultiCall.includesAllOutputsWithStatus,
      log: console
    }, options);
  }

}
exports.MultiCall = MultiCall;
