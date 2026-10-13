/** Static visual fixtures only. No wallet provider, API calls or production account data. */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync,readdirSync} from "node:fs";
import {FamilyConnections,Commitments,FeaturedGoal} from "../src/components/family-visuals";
import {Passport} from "../src/components/passport";
import {SavingStory} from "../src/components/saving-story";
import {GoalCard} from "../src/components/ui";
import type {Bundle} from "../src/lib/private";
const css=readdirSync(".next/static/css").map(name=>readFileSync(`.next/static/css/${name}`,"utf8")).join("\n");
const teen="0x"+"1".repeat(40), hash="0x"+"a".repeat(64);
const goal={id:"1",teen,teenFamId:"alex",memo:"Headphones",target:"40000000",saved:"12000000",matched:"8000000",deadline:1900000000,status:"ACTIVE",sponsorOpen:true};
const bundle:Bundle={role:"PARENT",familyId:1,freshness:{indexedBlock:42,chainHead:42,lagBlocks:0},commitments:{coverage:"complete",blockNumber:42,allowance:"15000000",missions:"5000000",futureFunds:"25000000"},data:{teens:[{id:teen,famId:"alex",level:0,frozen:false}],goals:[goal],missions:[],funds:[],fundEntries:[],history:[],weeks:[],progress:[],achievements:[{id:"first",teen,familyId:1,kind:"SAVED",sourceEvent:"fixture",txHash:hash,blockNumber:42,logIndex:0,ts:1791900000}],savingReceipts:[{id:"receipt",goalId:"1",teen,teenFamId:"alex",goalName:"Headphones",ownAmount:"4000000",matchedAmount:"4000000",totalAfter:"20000000",target:"40000000",source:"SAVING",missionId:"0",missionTitle:"",ts:1791900000,blockNumber:42,txHash:hash}],matchReleases:[],gifts:[],family:[]}};
const empty=process.env.REVIEW_EMPTY==="true";
const data=empty ? {...bundle,commitments:undefined,freshness:{indexedBlock:null,chainHead:42,lagBlocks:null},data:{...bundle.data,teens:[],goals:[],achievements:[],savingReceipts:[]}} : bundle;
const body=renderToStaticMarkup(<main className="workspace-main" style={{maxWidth:1100,margin:"auto"}}><p className="service-notice">DESIGN REVIEW · Static test fixtures. No real balances or transactions.</p><h1 className="text-3xl font-bold">Your family, growing together.</h1><FamilyConnections parent="priya" teens={data.data.teens!}/><section className="balance-strip"><div><p className="eyebrow">AVAILABLE TO ALLOCATE</p><h2 className="num text-4xl">{empty?"Not verified":"$30.00"}</h2><p>Parent’s spendable balance</p></div></section><Commitments bundle={data}/><FeaturedGoal goals={data.data.goals}/><div className="overview-columns"><Passport bundle={data} fetchedAt={0} error={null}/>{empty ? <SavingStory bundle={data} fetchedAt={0} error={null}/> : <GoalCard g={goal}/>}</div><SavingStory bundle={data} fetchedAt={0} error={null}/></main>);
console.log(`<!doctype html><html lang="en" data-theme="${process.env.REVIEW_THEME==="dark"?"dark":"light"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Fam-Fi visual review — test fixtures</title><style>${css}</style></head><body>${body}</body></html>`);
