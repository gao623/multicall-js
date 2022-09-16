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

  static formatOutputTypes(outputTypes) {
    var colLength = outputTypes.length
    var possibleOutputCount = outputTypes.reduce((reduced, types) => {
      const typeLength = Array.isArray(types) ? types.length : 1;
      reduced *= typeLength;
      return reduced;
    }, 1);

    var possibleOutputs = []
    for (let i = 0; i < possibleOutputCount; ++i) {
      possibleOutputs[i] = [];
      for (let j = 0; j < colLength; ++j) {
        const type = Array.isArray(outputTypes[j]) ? outputTypes[j][i%outputTypes[j].length] : outputTypes[j];
        possibleOutputs[i][j] = type;
      }
    }
    return possibleOutputs;
  }

  static async decodeEthMultiCallV2(targetInfo, returnData, log = console) {
    const blockNumber = returnData.blockNumber;
    const targetCallResultDecoded = returnData.returnData.reduce((acc, next, index) => {
      const allPossibleOutputTypes = BaseMultiCall.formatOutputTypes(targetInfo[index].outputTypes);

      const info = allPossibleOutputTypes.reduce((reduced, outputTypes) => {
        let targetDetails;
        try {
          targetDetails = web3EthAbi.decodeParameters(outputTypes, next);
        } catch (err) {
          log.warn("ignore error:", err);
        }
        if (targetDetails) {
          for (let i = 0; i < outputTypes.length; ++i) {
            if (targetInfo[index].outputNames
              && targetInfo[index].outputNames.length === outputTypes.length
            ) {
              reduced[targetInfo[index].outputNames[i]] || (reduced[targetInfo[index].outputNames[i]] = targetDetails[i]);
            } else if (outputTypes[i].name) {
              reduced[targetInfo[index].name[i]] || (reduced[outputTypes[i].name] = targetDetails[i]);
            } else {
              reduced[i] || (reduced[i] = targetDetails[i]);
            }
          }
        }
        return reduced;
      }, {});
      if (!Object.keys(info).length) {
        throw new Error("BaseMultiCall: Decode outputs error");
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