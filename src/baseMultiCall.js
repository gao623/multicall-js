const web3EthAbi = require("web3-eth-abi");
const { Helper } = require("./helper");

class BaseMultiCall {
  static makeTargetCallData(targetInfo) {
    let MultiTargetCallData = targetInfo.map(({address, funcName, inputTypes, args}) => {
      const hasComplexedParam = inputTypes.some( item => typeof(item) !== "string");

      let funcSignature;
      if (!hasComplexedParam) {
        funcSignature = web3EthAbi.encodeFunctionSignature(`${funcName}(${inputTypes.length? inputTypes.join(","):""})`);
      } else {
        funcSignature = web3EthAbi.encodeFunctionSignature({
          name: funcName, type: 'function', inputs: inputTypes
        });
      }

      let encodedParams = inputTypes.length ? Helper.hexStrip0x(web3EthAbi.encodeParameters(inputTypes, args)) : "";
      return [address, `${funcSignature}${encodedParams}`];
    });

    return MultiTargetCallData;
  }

  static async decodeEthMultiCall(targetInfo, returnData) {
    const blockNumber = returnData.blockNumber;
    const targetCallResultDecoded = returnData.returnData.reduce((acc, next, index) => {
      const targetDetails = web3EthAbi.decodeParameters(targetInfo[index].outputTypes, next);
      let info = {};
      for (let i = 0; i < targetInfo[index].outputTypes.length; ++i) {
        if (targetInfo[index].outputNames
          && targetInfo[index].outputNames.length === targetInfo[index].outputTypes.length
        ) {
          info[targetInfo[index].outputNames[i]] = targetDetails[i]
        } else if (targetInfo[index].outputTypes[i].name) {
          info[targetInfo[index].outputTypes[i].name] = targetDetails[i]
        } else {
          info[i] = targetDetails[i]
        }
      }
      acc.push(info);
      return acc;
    }, []);

    return {
      blockNumber: blockNumber,
      result: targetCallResultDecoded
    }
  }
}
module.exports = BaseMultiCall;