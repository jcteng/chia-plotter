const readline = require("readline");
const fs = require("fs");
const { EventEmitter } = require("events");
/**
 * 解析方法：
 * 1. 每个阶段使用阶段内的解析表产生数据
 * 2. 在解析表内找不到数据时
 * 3. 尝试在#phaseSwitcher中进行解析
 * 4. 在#phaseSwitcher中进行解析失败后尝试全表
 * 5. 每个解析匹配包含cb和next属性，如果存在next时进行解析组切换
 */
class ChiaLogParser extends EventEmitter {
  #phase = { phase: 0, action: "findMeta" }; //顺序解析时的进度，信息
  #plotPara = {}; //任务参数

  #phaseConext={
    phase1:{tablesMetric:[]},
    phase2:{tablesMetric:[]},
    phase3:{tablesMetric:[]},
    phase4:{tablesMetric:[]},
  }

  #phaseSwitcher = {
    PlotProgress1: {
      regex: /^Starting phase (\d+)\/(\d+): ([\s\S]+) into tmp files... ([a-zA-Z0-9]+ [a-zA-Z0-9]+ [a-zA-Z0-9]+ \d+:\d+:\d+ \d+)/gi,
      names: ["phaseId", "phaseNum", "action", "startTime"],
      cb: this.enterNewPhase.bind(this),
    },
    PlotProgress1_1: {
      regex: /^Starting phase (\d+)\/(\d+): ([\S]+) from tmp files into "([\S\s]+)" ... ([a-zA-Z0-9]+ [a-zA-Z0-9]+ [a-zA-Z0-9]+ \d+:\d+:\d+ \d+)/gi,
      names: ["phaseId", "phaseNum", "action", "file", "startTime"],
      cb: this.enterNewPhase.bind(this),
    },
    PlotProgress1_2: {
      regex: /^Starting phase (\d+)\/(\d+): Write ([\s\S]+) tables into "([\S\s]+)" ... ([a-zA-Z0-9]+ [a-zA-Z0-9]+ [a-zA-Z0-9]+ \d+:\d+:\d+ \d+)/gi,
      names: ["phaseId", "phaseNum", "action", "file", "startTime"],
      cb: this.enterNewPhase.bind(this),
    },
    phaseExit: {
      regex: /^Time for phase (\d+) = ([0-9\.]+) seconds. CPU \(([0-9\.]+)\%\) ([a-zA-Z0-9]+ [a-zA-Z0-9]+ [a-zA-Z0-9]+ \d+:\d+:\d+ \d+)/g,
      names: ["phaseId", "time", "cpu", "endTime"],
      cb :(formatObj)=>{
        formatObj.phaseId =  parseInt(formatObj.phaseId)
        formatObj.time = parseFloat(formatObj.time)
        formatObj.cpu = parseFloat(formatObj.cpu)
        this.emit("phase", "leave",{ ...this.#phase,...formatObj});
        if(formatObj.phaseId== this.#phase.phaseNum){
          this.#currentParsers = this.#phaseParsers.finalPhase
        }
      }

    },

  };
  #phaseParsers = {
    taskMetaPhase: {
      creationMeta1: {
        regex: /chia.plotting.create_plots [\s\S]+ Creating (\d+) plots of size ([0-9]+), pool public key:  ([0-9A-Za-z]+) farmer public key: ([A-Za-z0-9]+)/gi,
        names: ["plotNum", "plotSize", "pubKey", "farmerKey"],
        cb: (formatObj) => {
          Object.assign(this.#plotPara, formatObj);
        },
      },
      creationMeta2: {
        regex: /chia.plotting.create_plots [\s\S]+ Memo: ([0-9A-Za-z]+)/g,
        names: ["memo"],
        cb: (formatObj) => {
          Object.assign(this.#plotPara, formatObj);
        },
      },
      creationProgress: {
        regex: /chia.plotting.create_plots [\s\S]+ Starting plot ([0-9]+)\/([0-9]+)/g,
        names: ["index", "plotNum"],
        cb: (formatObj) => {

          Object.assign(this.#plotPara, formatObj);
          this.emit("taskPara",this.#plotPara)
        },
      },

      PlotMeta1: {
        regex: /Starting plotting progress into temporary dirs: ([\s\S]+) and ([\s\S]+)/g,
        names: ["temp1", "temp2"],
        cb: (formatObj) => {
          Object.assign(this.#plotPara, formatObj);
        },
      },
      PlotMeta2: {
        regex: /^ID: ([0-9A-Za-z]+)/g,
        names: ["plotId"],
        cb: (formatObj) => {
          Object.assign(this.#plotPara, formatObj);
        },
      },

      PlotMeta3: {
        regex: /^Plot size is: (\d+)/g,
        names: ["plotSize2"],
        cb: (formatObj) => {
          Object.assign(this.#plotPara, formatObj);
        },
      },

      PlotMeta4: {
        regex: /^Buffer size is: (\d+)MiB/g,
        names: ["bufferSize"],
        cb: (formatObj) => {
          Object.assign(this.#plotPara, formatObj);
        },
      },
      PlotMeta5: {
        regex: /^Using (\d+) buckets/g,
        names: ["buckets"],
        cb: (formatObj) => {
          Object.assign(this.#plotPara, formatObj);
        },
      },
      PlotMeta6: {
        regex: /Using (\d+) threads of stripe size (\d+)/g,
        names: ["threads", "strip"],
        cb: (formatObj) => {
          Object.assign(this.#plotPara, formatObj);
        },
      },
    },
    phase1: {
      PlotProgress2: {
        regex: /^Computing table (\d+)/g,
        names: ["computeTableId"],
        cb:({computeTableId})=>{
          this.#phaseConext.phase1.tableId = computeTableId
          this.emit("phase","tableEnter",{phase:this.#phase,table:{id:computeTableId}});
        }
      },

      PlotBucketUniform: {
        regex: /^Bucket (\d+) uniform sort. Ram: ([\d\.]+)GiB, u_sort min: ([0-9\.]+)GiB, qs min: ([0-9\.]+)GiB./g,
        names: ["bucketId", "ram", "u_sort", "qs_min"],
      },
      PlotBucketQS: {
        regex: /^Bucket (\d+) QS. Ram: ([\d\.]+)GiB, u_sort min: ([0-9\.]+)GiB, qs min: ([0-9\.]+)GiB. force_qs: ([0-9\.]+)/g,
        names: ["bucketId", "ram", "u_sort", "qs_min", "force_qs"],
      },
      PlotMatches: {
        regex: /^Total matches: (\d+)/g,
        names: ["bucketTotalMatches"],
      },
      phase1TablePropagationDone: {
        regex: /^Forward propagation table time: ([0-9\.]+) seconds. CPU \(([0-9\.]+)\%\) ([a-zA-Z0-9]+ [a-zA-Z0-9]+ [a-zA-Z0-9]+ \d+:\d+:\d+ \d+)/g,
        names: [
          "time",
          "cpu",
          "data",
        ],
        cb :this.phase1TableEnd.bind(this)
      },
      F1End: {
        regex: /^F1 complete, time: ([0-9\.]+) seconds. CPU \(([0-9\.]+)\%\) ([a-zA-Z0-9]+ [a-zA-Z0-9]+ [a-zA-Z0-9]+ \d+:\d+:\d+ \d+)/g,
        names: [
          "time",
          "cpu",
          "date",
        ],
        cb :this.phase1TableEnd.bind(this)
      }

    },
    phase2: {
      PlotProgress3: {
        regex: /^(\S+propagating) on table (\d+)/g,
        names: ["propagating", "table"],
      },
      PlotProgress4: {
        regex: /^(\S+) table (\d+)$/g,
        names: ["action", "table"],
      },
      PlotProgress7: {
        regex: /^(\S+) time =  ([0-9\.]+) seconds. CPU \(([0-9\.]+)%\) ([a-zA-Z0-9]+ [a-zA-Z0-9]+ [a-zA-Z0-9]+ \d+:\d+:\d+ \d+)$/g,
        names: ["action", "time","cpu","data"],
      } ,
      PlotProgress6: {
        regex: /^table (\d+) new size: (\d+)/g,
        names: ["table", "size"],
      },
      PlotProgress8: {
        regex: /^(Wrote): (\d+)$/g,
        names: ["wrote", "num"],
      },
    },
    phase3:{
      PlotProgress5: {
        regex: /^(Compressing) tables (\d+) and (\d+)$/g,
        names: ["action", "table", "table1"],
      },
      BucketUniform: {
        regex: /^Bucket (\d+) uniform sort. Ram: ([\d\.]+)GiB, u_sort min: ([0-9\.]+)GiB, qs min: ([0-9\.]+)GiB./g,
        names: ["bucketId", "ram", "u_sort", "qs_min"],
      },
      BucketQS: {
        regex: /^Bucket (\d+) QS. Ram: ([\d\.]+)GiB, u_sort min: ([0-9\.]+)GiB, qs min: ([0-9\.]+)GiB. force_qs: ([0-9\.]+)/g,
        names: ["bucketId", "ram", "u_sort", "qs_min", "force_qs"],
      },
      computation: {
        regex: /^(\S+) computation pass time: ([0-9\.]+) seconds. CPU \(([0-9\.]+)%\) ([a-zA-Z0-9]+ [a-zA-Z0-9]+ [a-zA-Z0-9]+ \d+:\d+:\d+ \d+)$/g,
        names: ["computePhase", "time", "cpu", "date"],
      },
      PlotProgress2_1: {
        regex: /^Wrote (\d+) entries$/g,
        names: ["wrote"],
      },
      compressTotal: {
        regex: /^Total (\S+) table time: ([0-9\.]+) seconds. CPU \(([0-9\.]+)%\) ([a-zA-Z0-9]+ [a-zA-Z0-9]+ [a-zA-Z0-9]+ \d+:\d+:\d+ \d+)$/g,
        names: ["total", "time", "cpu", "date"],
      },
    },
    phase4:{
      PlotProgressPhase4_2: {
        regex: /^Finished writing (\S+) table/g,
        names: [],
      },
      PlotProgressPhase4: {
        regex: /^(Starting) to (write) (\S+) and (\S+) tables/g,
        names: ["action", "operation", "table1", "table2"],
      },
      PlotProgressPhase4_1: {
        regex: /^(Finished) (writing) (\S+) and (\S+) tables/g,
        names: ["action", "operation", "table1", "table2"],
      },
      PlotProgressPhase4_3: {
        regex: /^Final table pointers:$/g,
        names: [],
      },
      PlotProgressPhase4_3: {
        regex: /^Writing (\S+) table$/g,
        names: [],
      },
      PlotProgress4: {
        regex: /^(\S+) table (\d+)$/g,
        names: ["action", "table"],
      },
      BucketUniform: {
        regex: /^Bucket (\d+) uniform sort. Ram: ([\d\.]+)GiB, u_sort min: ([0-9\.]+)GiB, qs min: ([0-9\.]+)GiB./g,
        names: ["bucketId", "ram", "u_sort", "qs_min"],
      },
      BucketQS: {
        regex: /^Bucket (\d+) QS. Ram: ([\d\.]+)GiB, u_sort min: ([0-9\.]+)GiB, qs min: ([0-9\.]+)GiB. force_qs: ([0-9\.]+)/g,
        names: ["bucketId", "ram", "u_sort", "qs_min", "force_qs"],
      },
      FinalTableIgr: {
        regex: /^Final table pointers:$/g,
        names: [],
      },
      FinalTable: {
        regex: /^([PC]\d): 0x([a-zA-Z0-9]+)$/g,
        names: ["entry", "ptr"],
      },
    },
    finalPhase:{
      PlotProgressPhase4_2: {
        regex: /([\s\S]*)/g,
        names: ["skip"],
      },
    }
  };

  #currentParsers = this.#phaseParsers.taskMetaPhase;
  constructor(fileName) {
    super();
    if (typeof fileName == "string") {
      this.buildInLineReader(fileName);
    }
  }
  phase1TableEnd(formatObj,phaseContext){
    formatObj.time = parseFloat(formatObj.time)
    formatObj.cpu = parseFloat(formatObj.cpu)
    let tableId = phaseContext.tableId
    let perfMetric = {tableId, ...formatObj}
    phaseContext.tablesMetric.push(perfMetric)
    this.emit("phase", "tableLeave",{  phase:this.#phase,table:{id:tableId,...formatObj}});
    if(phaseContext.tablesMetric.length==7){
      let sum = {time:0,cpu:0,date:""}
      phaseContext.tablesMetric.forEach(function(metric,idx){
        sum.time+=metric.time
        sum.cpu+=metric.cpu
        sum.date = metric.date
      },)
      sum.cpu = sum.cpu/phaseContext.tablesMetric.length
      this.emit("phase",'leave', {phase:{...this.#phase,...sum,context:phaseContext}});
    }
  }
  enterNewPhase(formatObj,phase) {
    formatObj.phaseId = parseInt(formatObj.phaseId)
    formatObj.phaseNum = parseInt(formatObj.phaseNum)

    this.#currentParsers = this.#phaseParsers["phase" + formatObj.phaseId];
    this.#phase = formatObj;
    if(formatObj.phaseId==1){
      this.emit("para",this.#plotPara)
    }
    this.emit("phase","enter",  { ...formatObj });
  }
  async buildInLineReader(fileName) {
    const rl = readline.createInterface({
      input: fs.createReadStream(fileName),
    });
    for await (const line of rl) {
      this.parseLine(line);
    }
    this.emit("fileEnd")

  }

  pasreWithParserGroup(parseGroup, line) {
    let found = false;

    for (let opName in parseGroup) {
      let op = parseGroup[opName];
      let matchAll = [...line.matchAll(op.regex)][0];
      if (matchAll != null) {
        let outObj = {};
        op.names.forEach((element, idx) => {
          outObj[element] = matchAll[1 + idx];
        });
        if (op.cb != null) {
          op.cb(outObj,this.#phaseConext['phase'+this.#phase.phaseId]);
        } else {
          this.emit("NoHandle",outObj,line)
        }

        found = true;
        break;
      }
    }
    return found;
  }
  parseLine(line) {
    line = line.trim();
    if (line == null || line.length == 0) return;

    let found = this.pasreWithParserGroup(this.#currentParsers, line);
    if (!found) {
      found = this.pasreWithParserGroup(this.#phaseSwitcher, line);

      if (found == false) {
        console.log("unknown", {phase:this.#phase,line});
      }
    }
  }
}

// let leaves = []
// let parser = new ChiaLogParser(
//   "C:\\Users\\jcteng\\.chia\\mainnet\\plotter\\plotter_log_3c7eb842-c90c-4eba-aa57-488ac83916c0.txt"
// )

// parser.on("phaseLeave",(phaseInfo)=>{
//   leaves.push(phaseInfo)
//   console.table(leaves)
// });

// parser.emit("fileEnd",()=>{console.table(leaves)})
// console.log("aa",leaves,parser)

module.exports = {ChiaLogParser}