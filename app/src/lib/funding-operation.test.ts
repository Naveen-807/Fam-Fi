import { test } from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { fundingOperationKey,parseFundingOperation,matchesFundingOperation } from "./funding-operation";
test("recovery metadata is scoped to chain, deployment and wallet",()=>{
  assert.notEqual(fundingOperationKey(10143,"a","one"),fundingOperationKey(10143,"a","two"));
  assert.notEqual(fundingOperationKey(10143,"a","one"),fundingOperationKey(10143,"b","one"));
  assert.notEqual(fundingOperationKey(10143,"a","one"),fundingOperationKey(143,"a","one"));
});
test("unrelated receipts and altered funding amounts cannot become deposit confirmations",()=>{
  const scope={wallet:"0x"+"1".repeat(40),token:"0x"+"2".repeat(40),contract:"0x"+"3".repeat(40)};
  const op={hash:"0x"+"a".repeat(64),stage:"depositing" as const,amount:"5000000"};
  const data=new ethers.Interface(["function depositFor(address,uint256)"]).encodeFunctionData("depositFor",[scope.wallet,op.amount]);
  const tx={from:scope.wallet,to:scope.contract,data};
  assert.equal(matchesFundingOperation(op,tx,scope),true);
  assert.equal(matchesFundingOperation(op,{...tx,from:scope.token},scope),false);
  assert.equal(matchesFundingOperation({...op,amount:"6000000"},tx,scope),false);
});
test("recovery validates hashes, stages and positive base-unit amounts",()=>{
  const op={hash:"0x"+"a".repeat(64),stage:"approving",amount:"5000000"};
  assert.deepEqual(parseFundingOperation(JSON.stringify(op)),op);
  for(const invalid of [{...op,stage:"confirmed"},{...op,hash:"oops"},{...op,amount:"0"},{...op,amount:"5.0"}]) assert.equal(parseFundingOperation(JSON.stringify(invalid)),null);
  assert.equal(parseFundingOperation("broken"),null);
});
