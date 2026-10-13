import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const U = (n:number) => BigInt(n)*1000000n;
async function setup() {
  const [parent, teen, other] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("MockUSDC")).deploy();
  const forwarder = await (await ethers.getContractFactory("FamFiForwarder")).deploy();
  const fam = await (await ethers.getContractFactory("FamFiV2")).deploy(await token.getAddress(), await forwarder.getAddress());
  await fam.register(ethers.encodeBytes32String("parent"), 1); await fam.createFamily(0);
  const terms = { levelLimits:[U(5),U(10),U(15),U(20)], newPayeeThreshold:U(3), firstDayCap:U(2), holdSeconds:600, strictHolds:true };
  const inviteId = ethers.id("v2-invite"), deadline = (await time.latest())+86400;
  const sig = await parent.signTypedData({name:"FamFi",version:"1",chainId:31337,verifyingContract:await fam.getAddress()}, {Invite:[{name:"familyId",type:"uint32"},{name:"inviteId",type:"bytes32"},{name:"deadline",type:"uint256"},{name:"levelLimits",type:"uint128[4]"},{name:"newPayeeThreshold",type:"uint128"},{name:"firstDayCap",type:"uint128"},{name:"holdSeconds",type:"uint32"},{name:"strictHolds",type:"bool"}]}, {familyId:1,inviteId,deadline,...terms});
  await fam.connect(teen).acceptInvite(1,inviteId,deadline,terms,sig,ethers.encodeBytes32String("teen"));
  await token.mint(parent.address,U(20)); await token.approve(await fam.getAddress(),U(20)); await fam.depositFor(parent.address,U(20));
  return {fam,token,parent,teen,other};
}
describe("FamFiV2 isolated release",()=>{
  it("only the linked parent can decline a proposed goal, without moving funds",async()=>{
    const {fam,teen,other,parent,token}=await setup();
    await fam.connect(teen).proposeGoal(U(10),(await time.latest())+86400,0,"Bike");
    await expect(fam.connect(other).declineGoal(1)).to.be.reverted;
    await expect(fam.declineGoal(1)).to.emit(fam,"GoalDeclined");
    expect((await fam.goals(1)).status).eq(5n); expect(await fam.balance(parent.address)).eq(U(20));
    expect(await token.balanceOf(await fam.getAddress())).eq(U(20));
    await expect(fam.approveGoal(1,true)).to.be.reverted;
    await fam.connect(teen).proposeGoal(U(10),(await time.latest())+86400,0,"New goal");
    expect(await fam.goalCount()).eq(2n);
  });
  it("review expires exactly at the seven-day boundary, refunds once and reconciles custody",async()=>{
    const {fam,teen,parent,other,token}=await setup(); const deadline=(await time.latest())+3600;
    await fam.createMission(teen.address,U(5),deadline,0,"Task",""); await fam.connect(teen).submitMission(1);
    const review=await fam.missionReviewDeadline(1); expect(review).eq(BigInt(deadline)+7n*86400n);
    await expect(fam.connect(other).approveMission(1)).to.be.reverted;
    await expect(fam.expireMission(1)).to.be.revertedWith("review not ended");
    await time.setNextBlockTimestamp(Number(review));
    await expect(fam.approveMission(1)).to.be.revertedWith("review ended");
    await expect(fam.rejectMission(1,"")).to.be.revertedWith("review ended");
    await fam.connect(other).expireMission(1); expect(await fam.balance(parent.address)).eq(U(20));
    expect(await fam.missionEscrow()).eq(0n); expect(await fam.openMissions(teen.address)).eq(0n);
    await expect(fam.expireMission(1)).to.be.reverted;
    expect(await token.balanceOf(await fam.getAddress())).eq(U(20));
  });
  it("approval before timeout pays once and prevents later expiry",async()=>{
    const {fam,teen}=await setup(); await fam.createMission(teen.address,U(5),(await time.latest())+3600,0,"Task","");
    await fam.connect(teen).submitMission(1); await fam.approveMission(1);
    expect(await fam.balance(teen.address)).eq(U(5)); await expect(fam.expireMission(1)).to.be.reverted;
  });
});
