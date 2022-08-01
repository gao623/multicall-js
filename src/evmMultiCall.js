const web3EthAbi = require("web3-eth-abi");

class MultiCall {
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

  static makeCallData(targetInfo) {
    // console.log("makeCallData targetInfo:", Array.isArray(targetInfo), typeof(targetInfo), targetInfo)
    let MultiTargetCallData = [targetInfo.map(({address, funcName, inputTypes, args}) => {
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
    })];
    // console.log("target contract data:", MultiTargetCallData);
    const calldata = web3EthAbi.encodeParameters(
      // [
      //   {
      //     components: [{ type: 'address' }, { type: 'bytes' }],
      //     name: 'data',
      //     type: 'tuple[]'
      //   }
      // ],
      [
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
      MultiTargetCallData
    );
    let aggregateSignature = web3EthAbi.encodeFunctionSignature(`aggregate((address,bytes)[])`);
    return `${aggregateSignature}${MultiCall.strip0x(calldata)}`;
  
  }

  static async ethCall(web3, multiCallAddress, abiEncodedData) {
    return await web3.eth.call({
      to: multiCallAddress,
      data: abiEncodedData
    });
  }

  static async multiCall(web3, multiCallAddress, targetInfo) {
    // let targetInfo = [
    //   {address:wanBTC, funcName:"balanceOf", inputTypes:["address"], outputTypes:["uint256"], outputNames:["balance"], args:[myTestAddr]},
    //   {address:wanETH, funcName:"balanceOf", inputTypes:["address"], outputTypes:["uint256"], outputNames:["balance"], args:[myTestAddr]},
    // ];
    // console.time("web3 multi-call")
    // console.time("web3 multi-call makeCallData")
    let abiEncodedData = MultiCall.makeCallData(targetInfo)
    // console.timeEnd("web3 multi-call makeCallData")
    // console.log("multi-call contract call data:", abiEncodedData);

    // console.time("web3 multi-call ethCall")
    let returnData = await MultiCall.ethCall(web3, multiCallAddress, abiEncodedData);
    // console.timeEnd("web3 multi-call ethCall")
    // let returnData = "0x0000000000000000000000000000000000000000000000000000000000dfcc270000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000d7343e372dc98b73";
    // console.log("returnData:", returnData);

    // console.time("web3 multi-call decodeParameters")
    let multiCallResultsDecodedDict = web3EthAbi.decodeParameters(['uint256', 'bytes[]'], returnData);
    // console.log("multiCallResultsDecodedDict:", multiCallResultsDecodedDict, typeof(multiCallResultsDecodedDict), Array.isArray(multiCallResultsDecodedDict));
    // console.timeEnd("web3 multi-call decodeParameters")

    let multiCallResultsDecoded = [];
    for (let i = 0; i < multiCallResultsDecodedDict.__length__; ++i) {
      multiCallResultsDecoded.push(multiCallResultsDecodedDict[i]);
    }
    // console.log("multiCallResultsDecoded:", multiCallResultsDecoded, Array.isArray(multiCallResultsDecoded));
    let blockNumber = multiCallResultsDecoded.shift();
    // console.log("blockNumber:", blockNumber);
    // console.time("web3 multi-call decode target parameters")
    let targetCallResultDecoded = multiCallResultsDecoded.reduce((acc, next) => {
      // console.log("next:", next)
      next.forEach((outputResults, index) => {
        // console.log("outputTypes:", targetInfo[index].outputTypes, typeof(outputResults), Array.isArray(targetInfo[index].outputTypes), "outputData:", outputResults, typeof(outputResults));
        let targetDetails = web3EthAbi.decodeParameters(targetInfo[index].outputTypes, outputResults);
        let targetResults = [];
        let info = {};
        // console.log("targetDetails:", targetDetails)
        for (let i = 0; i < targetInfo[index].outputTypes.length; ++i) {
        // for (let i = 0; i < outputResults.__length__; ++i) {
          // if (targetInfo[index].outputTypes[i] && targetInfo[index].outputTypes[i].name) {
          if (targetInfo[index].outputTypes[i].name) {
            info[targetInfo[index].outputTypes[i].name] = targetDetails[i]
          } else {
            info[i] = targetDetails[i]
          }
        }
        targetResults = info;
        // console.log("targetResults:", targetResults);
        acc.push(targetResults);
      });
      return acc;
    }, []);
    // console.timeEnd("web3 multi-call decode target parameters")
    // console.log("targetCallResultDecoded:", targetCallResultDecoded, blockNumber);
    // console.timeEnd("web3 multi-call")
    return [blockNumber, targetCallResultDecoded];
  }
}
module.exports = MultiCall;