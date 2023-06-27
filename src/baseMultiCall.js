const web3EthAbi = require("web3-eth-abi");
const {Helper} = require("./helper");

class BaseMultiCall {
  static makeTargetCallData(targetInfo) {
    let multiTargetEncodeData = targetInfo.reduce((reduced, {address, funcName, inputTypes, args}) => {
      let formatFuncNames = BaseMultiCall.formatFuncNames(funcName);
      for (const fName of formatFuncNames) {
        const functionCallData = web3EthAbi.encodeFunctionCall({name:fName, inputs:inputTypes},args);
        reduced.push([address, functionCallData]);
      }
      return reduced;
    }, []);
    return multiTargetEncodeData;
  }

  static decodeEthMultiCall(targetInfo, returnData) {
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

  static formatFuncInputTypes(inputTypes) {
    return inputTypes.map((inputType, index) => {
      return (typeof(inputType) === "string") ? {type: inputType, name: index} : inputType;
    });
  }

  static formatFuncNames(funcNames) {
    if (!funcNames || (Array.isArray(funcNames) && !funcNames.length)) {
      throw new Error(`invalid function name "${funcNames}"`);
    }
    const retFuncNames = !Array.isArray(funcNames) ? [funcNames] : funcNames.reduce((reduced, name) => {
      if (name) {
        reduced.push(name);
      }
      return reduced;
    }, []);
    if (!retFuncNames.length) {
      throw new Error(`invalid function name "${funcNames}"`);
    }
    return retFuncNames;
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

  static decodeEthMultiCallV2(targetInfo, returnData, options) {
    if (returnData.returnStatus && returnData.returnStatus.length !== returnData.returnData.length) {
      throw new Error(`invalid parameter "returnData"`);
    }
    const shouldParseStatus = returnData.returnStatus && returnData.returnStatus.length;
    const {log} = Object.assign({}, {
      log: console,
    }, options);

    const {
      blockNumber:retBlockNumber
      ,blockHash:retBlockHash
      ,returnData:retData
      ,returnStatus:retStatus
    } = returnData;

    let result = {};
    if (retBlockNumber !== undefined) {
      result.blockNumber = retBlockNumber;
    }
    if (retBlockHash !== undefined) {
      result.blockHash = retBlockHash;
    }

    let funcNameCount = 0;
    let funcNameRetDataRange = {};
    let retDataToTargetIndex = {};
    for (let targetIndex = 0; targetIndex < targetInfo.length; ++targetIndex) {
      const info = targetInfo[targetIndex];
      const fNameCount = BaseMultiCall.formatFuncNames(info.funcName).length;
      funcNameRetDataRange[targetIndex] = [funcNameCount, funcNameCount + fNameCount - 1];
      for (let i = 0; i < fNameCount; ++i) {
        retDataToTargetIndex[funcNameCount + i] = targetIndex;
      }
      funcNameCount += fNameCount;
    }

    let targetCallResultStatus = [];
    const targetCallResultDecoded = retData.reduce((reduced, data, index) => {
      const targetIndex = retDataToTargetIndex[index];
      const [retDataStartIndex, retDataEndIndex] = funcNameRetDataRange[targetIndex];

      if (!retStatus || retStatus[index]) {
        if (reduced.length === targetIndex) {
          const allPossibleOutputTypes = BaseMultiCall.formatOutputTypes(targetInfo[targetIndex].outputTypes);

          let decodeError;
          let info = {};
          for (const outputTypes of allPossibleOutputTypes) {
            let targetDetails;
            try {
              decodeError = undefined;
              targetDetails = web3EthAbi.decodeParameters(outputTypes, data);
            } catch (err) {
              decodeError = err;
              log.warn("ignore error:", err);
            }
            if (targetDetails) {
              for (let i = 0; i < outputTypes.length; ++i) {
                if (targetInfo[targetIndex].outputNames
                  && targetInfo[targetIndex].outputNames.length === outputTypes.length
                ) {
                  info[targetInfo[targetIndex].outputNames[i]] || (info[targetInfo[targetIndex].outputNames[i]] = targetDetails[i]);
                } else if (outputTypes[i].name) {
                  info[targetInfo[targetIndex].name[i]] || (info[outputTypes[i].name] = targetDetails[i]);
                } else {
                  info[i] || (info[i] = targetDetails[i]);
                }
              }
              break;
            }
          }
          if (!decodeError) {
            reduced.push(info);
            shouldParseStatus && targetCallResultStatus.push(true);
          } else {
            throw new Error(`BaseMultiCall.decodeEthMultiCallV2 decode '${JSON.stringify(targetInfo[targetIndex])}' outputs error:${Helper.parseError(decodeError)}`);
          }
        }
      }

      if (retDataEndIndex === index && reduced.length === targetIndex) {
        if (shouldParseStatus) {
          targetCallResultStatus.push(false);
          reduced.push(undefined);
        } else {
          throw new Error("Returned error: execution reverted");
        }
      }
      return reduced;
    }, []);

    result.result = targetCallResultDecoded;
    if (shouldParseStatus) {
      result.status = targetCallResultStatus;
    }

    return result;
  }

}
module.exports = BaseMultiCall;