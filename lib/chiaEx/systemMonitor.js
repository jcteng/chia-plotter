const cp = require("child_process");
const stream = require("stream");
const readline = require("readline");
const { EventEmitter } = require("events");

class ChiaPlotterSystemMon extends EventEmitter {
  constructor(
    processName = "chia*",
    interval = 1,
    count = 30,
    appends = ["_Total", "Idle", "System"]
  ) {
    super();
    this.PerfCols = this.buildCommands(processName);
    appends.forEach((name) => {
      this.PerfCols = this.PerfCols.concat(this.buildCommands(name));
    });
    this.interval = interval;
    let cliArgs = ["-si", interval, "-sc", count];

    //if(interval)
    this.cliArgs = cliArgs.concat(this.PerfCols);
    this.proc = null;
    this.count = count;
    // console.log("typeperf "+this.cliArgs.join(" "))
  }
  buildCommands(processName) {
    return [
      `\\Process(${processName})\\% Processor Time`,
      `\\Process(${processName})\\ID Process`,
      `\\Process(${processName})\\Creating Process ID`,
      `\\Process(${processName})\\Working Set`,
      `\\Process(${processName})\\Working Set Peak`,
      `\\Process(${processName})\\IO Read Bytes/sec`,
      `\\Process(${processName})\\IO Write Bytes/sec`,
    ];
  }
  formatProcessColName(colList) {
    let outColName = [];
    outColName[0] = "time";
    for (let i = 1; i < colList.length; i++) {
      let parts = colList[i].split("\\");

      outColName[i] = {
        name: parts[4].replace(/ /g, "").replace(/\%/g, "").replace(/\//g, ""),
        proc: parts[3].replace(/Process\(/g, "").replace(/\)/g, ""),
      };
    }
    return outColName;
  }
  async typeperfProcess() {
    let proc;
    let res = await new Promise(async (r) => {
      let col;

      this.proc = proc = cp.spawn(`typeperf`, this.cliArgs, {});
      proc.on("exit", (...args) => r(args));

      //   proc.stdout.on("data",z=>console.log(iconv.decode(z,'GBK')))
      console.log("perfmon started...", proc.pid);
      let name2PidList = null;
      let rl = readline.createInterface({ input: proc.stdout }); // proc.stdout });
      let count = 0;
      for await (let line of rl) {
        if (line.trim().length == 0) continue;
        if (count++ == 0) {
          col = line.replace(/\"/g, "").split(",");
          col = this.formatProcessColName(col);
        } else {
          let csv2Array = line.replace(/\"/g, "").split(",");

          if (name2PidList == null) {
            let name2PidList = {};
            //映射名字到ID
            col.forEach((colHeader, idx) => {
              if (colHeader.name == "IDProcess") {
                name2PidList[colHeader.proc] = csv2Array[idx];
              }
            });
            //用进程名称标记每列的PID信息
            col.forEach((colHeader, idx) => {
              if (idx > 0) colHeader.pid = name2PidList[colHeader.proc] | 0;
            });
          }

          let sampleTime;
          let groupSample = {};
          if (col.length != csv2Array.length) continue;
          col.forEach((colItem, idx) => {
            if (idx == 0) {
              sampleTime = csv2Array[0];
              return;
            }
            //   if(colItem.proc.startsWith("Chia")){return}
            if ("IDProcess" == colItem.name) {
              return;
            }
            let groupIdx = colItem.proc + colItem.pid;
            let groupLine = groupSample[groupIdx];
            if (groupLine == null) {
              groupLine = groupSample[groupIdx] = {
                time: sampleTime,
                pid: colItem.pid,
                name: colItem.proc,
              };
            }
            groupLine[colItem.name] =
              idx > 0 ? parseFloat(csv2Array[idx]) : csv2Array[idx];
          });
          //   console.table(Object.values(groupSample));
          this.emit("sample", groupSample);
        }
      }
    });
    console.log("typeperf exited", res);
    return res;
  }
  async start() {
    for (;;) {
      await this.typeperfProcess();
      //Promise.race([,new Promise(r=>setTimeout(r,(this.count-2)*1000))])
    }
  }

  //wmic process where (parentID=12345)
  //WMIC Partition
  //wmic PhyicalDisk
  //wmic process where Name^="chia.exe"
  /**
   *
   * @param {} query
   * @returns { {err,data}}
   *
   */
  async wmicQuery(query) {
    let [err, stdout, stderr] = await new Promise((r) =>
      cp.exec(`wmic ${query} /format:csv`, (...args) => r(args))
    );
    let lines = stdout.replace(/\r/g, "").replace(/\"/g, "").trim().split("\n");
    let colHeader = [];
    if (err != null) {
      return { err };
    }
    let result = { err: null, data: [] };
    lines.forEach((line, idx) => {
      // if (idx == 0) return;
      if (idx == 0) {
        colHeader = line.split(",");
        return;
      }

      let valueArr = line.split(",");
      let lineObject = {};
      for (let i = 0; i < valueArr.length; i++) {
        lineObject[colHeader[i]] = valueArr[i];
      }
      result.data.push(lineObject);
    });
    return result;
  }
  /**
 *
 * @returns {
  Node: 'DESKTOP-U1BO4E5',
  Caption: 'chia.exe',
  CommandLine: 'chia.exe plots create -k32 -n1 -tD:\\chiatemp -2D:\\chiatemp -dH:\\ -b3390 -u128 -r2 -a3409995178',
  CreationClassName: 'Win32_Process',
  CreationDate: '20210427150557.659379+480',
  CSCreationClassName: 'Win32_ComputerSystem',
  CSName: 'DESKTOP-U1BO4E5',
  Description: 'chia.exe',
  ExecutablePath: 'C:\\Users\\jcteng\\AppData\\Local\\chia-blockchain\\app-1.1.2\\resources\\app.asar.unpacked\\daemon\\',
  ExecutionState: '',
  Handle: '19764',
  HandleCount: '301',
  InstallDate: '',
  KernelModeTime: '7058906250',
  MaximumWorkingSetSize: '1380',
  MinimumWorkingSetSize: '200',
  Name: 'chia.exe',
  OSCreationClassName: 'Win32_OperatingSystem',
  OSName: 'Microsoft Windows 10 Pro|C:\\WINDOWS|\\Device\\Harddisk1\\Partition4',
  OtherOperationCount: '23439',
  OtherTransferCount: '2993184',
  PageFaults: '11500996',
  PageFileUsage: '3561036',
  ParentProcessId: '18068',
  PeakPageFileUsage: '4109852',
  PeakVirtualSize: '8627417088',
  PeakWorkingSetSize: '3723992',
  Priority: '8',
  PrivatePageCount: '3646500864',
  ProcessId: '19764',
  QuotaNonPagedPoolUsage: '38',
  QuotaPagedPoolUsage: '187',
  QuotaPeakNonPagedPoolUsage: '59',
  QuotaPeakPagedPoolUsage: '187',
  ReadOperationCount: '6809200',
  ReadTransferCount: '1217984362464',
  SessionId: '1',
  Status: '',
  TerminationDate: '',
  ThreadCount: '1',
  UserModeTime: '206298125000',
  VirtualSize: '8066027520',
  WindowsVersion: '10.0.19042',
  WorkingSetSize: '1768718336',
  WriteOperationCount: '15927004',
  WriteTransferCount: '1229139323074'
  }
  */
  async getChiaProcess() {
    return this.wmicQuery('process where Name^="chia.exe" get /all');
  }
  async getProcessById(pid){
    return this.wmicQuery(`process where ProcessId=${pid} get /all`)
  }
  async getProcessByParentId(ParentProcessId){
    return this.wmicQuery(`process where ParentProcessId=${ParentProcessId} get /all`)
  }
}
async function main() {
  let instance = new ChiaPlotterSystemMon();
  //instance.on("sample", (...args) => console.log(JSON.stringify(args, 3, 3)));
  instance.on("sample", console.table);
  let running = await instance.start();
  console.log("exit", running);
}
main();
//reference https://chiacalculator.com/
