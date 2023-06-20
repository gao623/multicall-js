const web3EthAbi = require("web3-eth-abi");
const BaseMultiCall = require("./baseMultiCall");

class MultiCall extends BaseMultiCall {
  static makeEthCallData(targetInfo, options) {
    options = Object.assign({}, {aggregateFuncName: MultiCall.defaultAggregateFuncName}, options);
    const aggregateFuncName = options.aggregateFuncName || MultiCall.defaultAggregateFuncName;
    const multiTargetCallData = MultiCall.makeTargetCallData(targetInfo);
    const {inputs, name} = MultiCall.makerDaoInfo.funcAbiDict[aggregateFuncName] || MultiCall.customInfo.funcAbiDict[aggregateFuncName];

    if (inputs.length === 1) {
      return web3EthAbi.encodeFunctionCall({
        name: name,
        inputs: inputs,
      }, [multiTargetCallData]);
    } else if (inputs.length === 2) {
      const { requireSuccess } = options;
      return web3EthAbi.encodeFunctionCall({
        name: name,
        inputs: inputs,
      }, [!!requireSuccess, multiTargetCallData]);
    }
    throw new Error(`invalid aggregate "${aggregateFuncName}"`);
  }

  static async ethCall(web3, multiCallAddress, abiEncodedData, options) {
    options = Object.assign({}, {aggregateFuncName: MultiCall.defaultAggregateFuncName}, options);
    const aggregateFuncName = options.aggregateFuncName || MultiCall.defaultAggregateFuncName;
    MultiCall.makerDaoInfo.funcAbiDict[aggregateFuncName] || MultiCall.customInfo.funcAbiDict[aggregateFuncName];
    const outputTypes = MultiCall.makerDaoInfo.funcAbiDict[aggregateFuncName]
      ? MultiCall.makerDaoInfo.funcAbiDict[aggregateFuncName].outputs
      : MultiCall.customInfo.funcAbiDict[aggregateFuncName].outputs
    ;

    const returnData = await web3.eth.call({
      to: multiCallAddress,
      data: abiEncodedData
    });
    const multiCallResultsDecodedDict = web3EthAbi.decodeParameters(outputTypes, returnData);

    let result = {};
    for (let i = 0; i < multiCallResultsDecodedDict.__length__; ++i) {
      if (outputTypes[i].components && outputTypes[i].components.length === 2) {
        const {returnStatus, returnData} = multiCallResultsDecodedDict[i].reduce((reduced, data) => {
          const [isSuccess, retData] = data;
          reduced.returnStatus.push(isSuccess);
          reduced.returnData.push(retData);
          return reduced;
        }, {returnStatus:[], returnData:[]});
        result.returnStatus = returnStatus;
        result.returnData = returnData;
      } else {
        result[outputTypes[i].name] = multiCallResultsDecodedDict[i];
      }
    }
    return result;
  }

  static async trxCall(tronWeb, multiCallAddress, targetCallData, options) {
    options = Object.assign({}, {aggregateFuncName: MultiCall.defaultAggregateFuncName}, options);
    const aggregateFuncName = options.aggregateFuncName || MultiCall.defaultAggregateFuncName;
    const {outputs:outputTypes, inputs:inputsTypes} = MultiCall.makerDaoInfo.funcAbiDict[aggregateFuncName]
      ? MultiCall.makerDaoInfo.funcAbiDict[aggregateFuncName]
      : MultiCall.customInfo.funcAbiDict[aggregateFuncName]
    ;
    const aggregateAbi = MultiCall.makerDaoInfo.funcAbiDict[aggregateFuncName]
    ? MultiCall.makerDaoAbi
    : MultiCall.customAbi
  ;

    const contract = await tronWeb.contract(aggregateAbi, multiCallAddress);
    let retData
    if (inputsTypes.length === 1) {
      retData = await contract[aggregateFuncName](targetCallData).call();
    } else if (inputsTypes.length === 2) {
      const { requireSuccess } = options;
      retData = await contract[aggregateFuncName](!!requireSuccess, targetCallData).call();
    } else {
      throw new Error(`invalid aggregate "${aggregateFuncName}"`);
    }

    let result = {};
    for (let i = 0; i <retData.length; ++i) {
      const convertType = outputTypes[i].type;
      const [prefixInt, suffixInt] = convertType.split("int256")
      if ((!prefixInt || prefixInt === "u") && (!suffixInt || !Number.isNaN(parseInt(suffixInt)))) {
        // int* or uint* but not array
        result[outputTypes[i].name] = retData[i].toString();
      } else if (outputTypes[i].components && outputTypes[i].components.length === 2) {
        const {returnStatus, returnData} = retData[i].reduce((reduced, data) => {
          const [isSuccess, retData] = data;
          reduced.returnStatus.push(isSuccess);
          reduced.returnData.push(retData);
          return reduced;
        }, {returnStatus:[], returnData:[]})
        result.returnStatus = returnStatus;
        result.returnData = returnData;
      } else {
        result[outputTypes[i].name] = retData[i];
      }
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

  static customAbi = require("./abi/abi.CustomAggregate.json");
  static makerDaoAbi = require("./abi/abi.MakerDaoAggregate.json");
  static customInfo = MultiCall.customAbi.reduce((reduced, funcAbi) => {
    if (funcAbi.type === "function") {
      reduced.funcAbiDict[funcAbi.name] = funcAbi;
      reduced.funcNameDict[funcAbi.name] = funcAbi.name;
    }
    return reduced;
  }, {funcAbiDict:{}, funcNameDict:{}});
  static makerDaoInfo = MultiCall.makerDaoAbi.reduce((reduced, funcAbi) => {
    if (funcAbi.type === "function") {
      reduced.funcAbiDict[funcAbi.name] = funcAbi;
      reduced.funcNameDict[funcAbi.name] = funcAbi.name;
    }
    return reduced;
  }, {funcAbiDict:{}, funcNameDict:{}});
  static defaultAggregateFuncName = MultiCall.makerDaoInfo.funcNameDict.aggregate;

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
    const multiRequestResult = await MultiCall[multiCallType](client, multiCallAddress, inputTargetInfo, options);
    const result = MultiCall.decodeEthMultiCallV2(inputTargetInfo, multiRequestResult, options);
    return result;
  }

  static __parseOptions(options) {
    options = Object.assign({}, {
      multiCallType: MultiCall.multiCallTypeDict.ethMultiCall,
      aggregateFuncName: MultiCall.defaultAggregateFuncName,
      requireSuccess: false,
      log: console
    }, options);

    const { multiCallType, aggregateFuncName } = options;
    if (!MultiCall.multiCallTypeDict[multiCallType]) {
      throw new Error(`invalid multiCallType "${multiCallType}", it should be one of [${Object.values(MultiCall.multiCallTypeDict)}]`);
    }
    if (!MultiCall.customInfo.funcAbiDict[aggregateFuncName] && !MultiCall.makerDaoInfo.funcAbiDict[aggregateFuncName]) {
      throw new Error(`invalid aggregateFuncName "${aggregateFuncName}", it should be one of MakerDAO Multicall function [${Object.keys(MultiCall.makerDaoInfo.funcAbiDict)}], or one of Custom MulticallV2 function [${Object.keys(MultiCall.customInfo.funcAbiDict)}]`);
    }

    return options;
  }

}
exports.MultiCall = MultiCall;
