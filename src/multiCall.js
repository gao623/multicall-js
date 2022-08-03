const web3EthAbi = require("web3-eth-abi");
const BaseMultiCall = require("./baseMultiCall");
const { Helper } = require("./helper");

class MultiCall extends BaseMultiCall {
  static makeEthCallData(targetInfo) {
    let MultiTargetCallData = MultiCall.makeTargetCallData(targetInfo);
    const calldata = web3EthAbi.encodeParameters(
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
      [MultiTargetCallData]
    );
    let aggregateSignature = web3EthAbi.encodeFunctionSignature(`aggregate((address,bytes)[])`);
    return `${aggregateSignature}${Helper.hexStrip0x(calldata)}`;
  }

  static async ethCall(web3, multiCallAddress, abiEncodedData) {
    const returnData = await web3.eth.call({
      to: multiCallAddress,
      data: abiEncodedData
    });
    const multiCallResultsDecodedDict = web3EthAbi.decodeParameters(['uint256', 'bytes[]'], returnData);

    let multiCallResultsDecoded = [];
    for (let i = 0; i < multiCallResultsDecodedDict.__length__; ++i) {
      multiCallResultsDecoded.push(multiCallResultsDecodedDict[i]);
    }
    const blockNumber = multiCallResultsDecoded.shift();
    return {
      blockNumber: blockNumber,
      returnData: multiCallResultsDecoded.shift()
    }
  }

  static async trxCall(tronWeb, multiCallAddress, targetCallData) {
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
    const contract = await tronWeb.contract(abi, multiCallAddress);
    let retData = await contract.aggregate(targetCallData).call();
    return {
      blockNumber: retData.blockNumber.toString(),
      returnData: retData.returnData
    }
  }

  static async ethMultiCall(web3, multiCallAddress, targetInfo, options) {
    const abiEncodedData = MultiCall.makeEthCallData(targetInfo)
    const returnData = await MultiCall.ethCall(web3, multiCallAddress, abiEncodedData);
    return returnData;
  }

  static async trxMultiCall(tronWeb, multiCallAddress, targetInfo, options) {
    const abiEncodedData = MultiCall.makeTargetCallData(targetInfo)
    if (!tronWeb.defaultAddress.hex) {
      tronWeb.setAddress(multiCallAddress);
    }
    const returnData = await MultiCall.trxCall(tronWeb, multiCallAddress, abiEncodedData);
    return returnData;
  }

}
exports.MultiCall = MultiCall;
