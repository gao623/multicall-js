const web3EthAbi = require("web3-eth-abi");

class TrxMultiCall {
  static strip0x(str) {
    return str.replace(/^0x/, '');
  }
  static makeTargetCallData(targetInfo) {
    // console.log("makeTargetCallData targetInfo:", Array.isArray(targetInfo), typeof(targetInfo), targetInfo)
    let MultiTargetCallData = targetInfo.map(({address, funcName, inputTypes, args}) => {
      // console.log("funcName", funcName, "inputTypes:", JSON.stringify(inputTypes))
      const hasComplexedParam = inputTypes.some( item => typeof(item) !== "string");

      let funcSignature;
      if (!hasComplexedParam) {
        funcSignature = web3EthAbi.encodeFunctionSignature(`${funcName}(${inputTypes.length? inputTypes.join(","):""})`);
      } else {
        funcSignature = web3EthAbi.encodeFunctionSignature({
          name: funcName, type: 'function', inputs: inputTypes
        });
      }

      let encodedParams = inputTypes.length ? MultiCall.strip0x(web3EthAbi.encodeParameters(inputTypes, args)) : "";
      return [address, `${funcSignature}${encodedParams}`];
    });
    // console.log("target contract data:", MultiTargetCallData);

    return MultiTargetCallData;
  }

  static async ethCall(tronWeb, multiCallAddress, targetCallData) {
    const abi = [{
      "constant": true,
      "inputs": [
        {
          "components": [
            {
              "name": "target",
              "type": "address"
            },
            {
              "name": "callData",
              "type": "bytes"
            }
          ],
          "name": "calls",
          "type": "tuple[]"
        }
      ],
      "name": "aggregate",
      "outputs": [
        {
          "name": "blockNumber",
          "type": "uint256"
        },
        {
          "name": "returnData",
          "type": "bytes[]"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    }];
    // console.log("multiCallAddress:", multiCallAddress, "targetCallData:", targetCallData);
    const contract = await tronWeb.contract(abi, multiCallAddress);
    let retData = await contract.aggregate(targetCallData).call();
    return {
      blockNumber: retData.blockNumber,
      returnData: retData.returnData
    }
  }

  static async multiCall(tronWeb, multiCallAddress, targetInfo, options) {
    options = Object.assign({}, {withBlockNumber: false}, options);
    // let targetInfo = [
    //   {address:wanBTC, funcName:"balanceOf", inputTypes:["address"], outputTypes:["uint256"], outputNames:["balance"], args:[myTestAddr]},
    //   {address:wanETH, funcName:"balanceOf", inputTypes:["address"], outputTypes:["uint256"], outputNames:["balance"], args:[myTestAddr]},
    // ];
    // console.time("tronWeb multi-call")
    // console.time("tronWeb multi-call makeTargetCallData")
    let abiEncodedData = MultiCall.makeTargetCallData(targetInfo)
    // console.timeEnd("tronWeb multi-call makeTargetCallData")
    // console.log("multi-call contract call data:", abiEncodedData);

    // console.time("tronWeb multi-call ethCall")
    let returnData = await MultiCall.ethCall(tronWeb, multiCallAddress, abiEncodedData);
    // console.timeEnd("tronWeb multi-call ethCall")
    // let returnData = "0x0000000000000000000000000000000000000000000000000000000000dfcc270000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000d7343e372dc98b73";
    // console.log("returnData:", returnData);

    let blockNumber = returnData.blockNumber;
    // console.log("blockNumber:", blockNumber);
    // console.time("tronWeb multi-call decode target parameters")
    let targetCallResultDecoded = returnData.returnData.reduce((acc, next, index) => {
      // console.log("acc:", acc, "next:", next, "index:", index);

      let targetResults = [];
      let info = {};
      let targetDetails = web3EthAbi.decodeParameters(targetInfo[index].outputTypes, next);
      // console.log("acc:", acc, "next:", next, "index:", index, targetDetails);
      for (let i = 0; i < targetInfo[index].outputTypes.length; ++i) {
        // console.log("targetInfo:", targetInfo);
        // console.log(`targetInfo[${index}].outputTypes[${i}]`, targetInfo[index].outputTypes[i]);
        if (targetInfo[index].outputTypes[i].name) {
          info[targetInfo[index].outputTypes[i].name] = targetDetails[i]
        } else if (targetInfo[index].outputNames.length === targetInfo[index].outputTypes.length) {
          info[targetInfo[index].outputNames[i]] = targetDetails[i]
        } else {
          info[i] = targetDetails[i]
        }
      }
      targetResults = info;
      acc.push(targetResults);
      return acc;
    }, []);
    // console.timeEnd("tronWeb multi-call decode target parameters")
    // console.log("targetCallResultDecoded:", targetCallResultDecoded, blockNumber);
    // console.timeEnd("tronWeb multi-call")
    if (!options.withBlockNumber) {
      return targetCallResultDecoded;
    } else {
      return [blockNumber, targetCallResultDecoded];
    }
  }
}
module.exports = TrxMultiCall;