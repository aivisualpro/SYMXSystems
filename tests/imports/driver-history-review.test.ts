import { describe, expect, it } from "vitest";
import { driverMetricRanks, summarizeDriverHistory, type DriverHistoryWeek } from "@/lib/driver-ranking/driver-history-review";
const row=(week:string,score:number,rank:number,overrides:Partial<DriverHistoryWeek>={}):DriverHistoryWeek=>({week,finalScore:score,rank,safetyScore:98,qualityScore:97,workloadScore:82,efficiency:100,deliveryDays:4,packagesPerDay:250,teamPackagesPerDay:240,callOuts:0,writeUps:0,metrics:{speeding:0,seatbelt:0,distractions:0,signSignal:0,followingDistance:0,cdf:0,dsb:0,deliveryCompletion:0,pod:100,psb:0},...overrides});
describe("six-week driver manager review",()=>{
  it("classifies improving, declining, and stable trends using all weeks",()=>{
    expect(summarizeDriverHistory([90,91,92,94].map((score,index)=>row(`W${index}`,score,8-index))).trend).toBe("Improving");
    expect(summarizeDriverHistory([98,97,95,93].map((score,index)=>row(`W${index}`,score,index+1))).trend).toBe("Declining");
    expect(summarizeDriverHistory([95,95.1,94.9].map((score,index)=>row(`W${index}`,score,3))).trend).toBe("Stable");
  });
  it("requires three weeks for a trend and preserves missing efficiency",()=>{
    const review=summarizeDriverHistory([row("W1",96,4,{efficiency:null}),row("W2",97,2,{efficiency:null})]);
    expect(review.trend).toBe("Not enough data");expect(review.rankMovement).toBe(2);expect(review.bestArea).not.toBe("Efficiency");
  });
  it("requires recurring quality issues rather than one random week",()=>{
    const one=[row("W1",96,3,{metrics:{...row("",0,0).metrics,cdf:100}}),row("W2",97,2),row("W3",98,1)];
    expect(summarizeDriverHistory(one).recurringIssues).toEqual([]);expect(summarizeDriverHistory(one).mainFocus).toBe("Maintain Performance");
    const repeated=one.map((value,index)=>index<2?{...value,metrics:{...value.metrics,deliveryCompletion:50}}:value);
    expect(summarizeDriverHistory(repeated)).toMatchObject({mainFocus:"Delivery Completion",managerStatus:"Needs Coaching",recurringIssues:[{label:"Delivery Completion",weeks:2}]});
  });
  it("prioritizes repeated safety issues",()=>{
    const history=[0,1,2].map(index=>row(`W${index}`,96+index,3-index,{metrics:{...row("",0,0).metrics,followingDistance:index<2?1:0,deliveryCompletion:index<2?10:0}}));
    expect(summarizeDriverHistory(history)).toMatchObject({mainFocus:"Following Distance",managerStatus:"Needs Coaching"});
  });
  it("finds lower-is-better and higher-is-better improvements and consistency",()=>{
    const history=[row("W1",94,5,{efficiency:95,metrics:{...row("",0,0).metrics,cdf:100,pod:95}}),row("W2",96,3,{efficiency:98,metrics:{...row("",0,0).metrics,cdf:50,pod:97}}),row("W3",98,1,{efficiency:101,metrics:{...row("",0,0).metrics,cdf:0,pod:99}})];
    const review=summarizeDriverHistory(history);expect(review.improvingAreas).toEqual(expect.arrayContaining(["CDF","POD","Efficiency"]));expect(review.consistency).toMatchObject({strongWeeks:2,validWeeks:3});
  });
  it("uses competition ranking, marks ties, and leaves missing metrics unranked",()=>{
    const driver=(id:string,finalScore:number,cdf:number|null,efficiency:number|null)=>({transporterId:id,score:{finalScore,safetyScore:98,qualityScore:97,workloadScore:82,packagesPerDeliveryDay:250},efficiency:{average:efficiency},amazonWeekly:{quality:{cdf:{value:cdf},dsb:{value:0},deliveryCompletion:{value:0},pod:{value:100},psb:{value:0}}}}) as any;
    const ranks=driverMetricRanks([driver("A",99,10,100),driver("B",98,10,null),driver("C",98,20,95),driver("D",96,null,90)],"B")!;
    expect(ranks.finalScore).toMatchObject({rank:2,tied:true});
    expect(driverMetricRanks([driver("A",99,10,100),driver("B",98,10,null),driver("C",98,20,95),driver("D",96,null,90)],"C")!.finalScore.rank).toBe(2);
    expect(ranks.cdf).toMatchObject({rank:1,tied:true});
    expect(ranks.efficiency).toEqual({value:null,rank:null,tied:false});
  });
  it("tracks clean and performance streaks and breaks them on a missing ranked week",()=>{
    const history=[row("2026-W34",96,6),row("2026-W36",98,3)];
    const review=summarizeDriverHistory(history,["2026-W34","2026-W35","2026-W36"]);
    expect(review.streaks).toMatchObject({top5:1,safety:1,cdf:1,efficiency100:1,packagesAboveAverage:1});
  });
  it("requires real safety data for a clean week and preserves the approved streak rules",()=>{
    const missingSafety={speeding:null,seatbelt:null,distractions:null,signSignal:null,followingDistance:null,cdf:0,dsb:0,deliveryCompletion:0,pod:100,psb:0};
    const review=summarizeDriverHistory([
      row("2026-W35",97,4,{deliveryDays:5,metrics:missingSafety}),
      row("2026-W36",98,2,{deliveryDays:5,metrics:{...missingSafety,speeding:0},qualityScore:96,efficiency:101,packagesPerDay:260,teamPackagesPerDay:250}),
    ]);
    expect(review.streaks).toMatchObject({safety:1,speeding:1,quality95:2,efficiency100:2,packagesAboveAverage:2,fiveDays:2,top5:2});
  });
});
