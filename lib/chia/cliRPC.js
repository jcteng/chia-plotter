const chiaPath = require("./path");
const cp = require("child_process");
const fs = require("fs");
const EventEmitter = require("events");
const path = require("path");
const { mainModule } = require("process");
class cliRPC extends EventEmitter {
  #option = {
    cwd: "",
  };
  #logIdx = 0;
  constructor(locate) {
    super();
    this.initCWD();
    console.log(
      `use ${this.#option.cwd} as base,// PATH, detected version is ${
        this.chiaVerion
      }`
    );
  }
  initCWD(locate) {
    if (locate != null) {
      this.#option.cwd = locate;
      return;
    }
    console.log("No install locate yet,start auto find ...");
    let locates = chiaPath.ExecLocations();
    if (locates.length == 0) {
      throw new Error("can't find installation,// PATH");
    }
    this.#option.cwd = locates[0].locate;
  }
  get chiaVerion() {
    return cp.execSync("chia version", this.#option).toString().trim();
  }
  chiaVersionsList() {
    let versions = [];
    chiaPath.ExecLocations().forEach((v) => {
      versions.push(
        cp.execSync("chia version", { cwd: v.locate }).toString().trim()
      );
    });
    return versions;
  }
  plotPaths() {
    let out = [];
    cp.execSync("chia plots show", this.#option)
      .toString()
      .trim()
      .replace(/\r/g, "")
      .split("\n")
      .forEach((line) => {
        if (fs.existsSync(line.trim())) {
          out.push(line);
        }
      });

    return out;
  }
  get walletRecvAddress() {
    return cp
      .execSync("chia wallet get_address", this.#option)
      .toString()
      .trim();
  }

  _createPlot(args) {
    //add self dafault rules

    if (args.k_size < 32) args["-override-k"] = true;
    if (args.$2_tmp2_dir == null) args.$2_tmp2_dir = args.t_tmp_dir;
    if (args.r_num_threads == null) args.r_num_threads = 3;

    let raw_cmd_dict = {};
    for (let key in args) {
      if (args[key] != null) {
        let raw_flag = key.replace(/\$/g, "").split("_")[0];
        raw_cmd_dict[raw_flag] = args[key];
        //布尔类型的表达为存在与否 ，flags=true 表示该标记存在
        if (typeof raw_cmd_dict[raw_flag] == "boolean") {
          if (args[key]) {
            raw_cmd_dict[raw_flag] = "";
          } else {
            delete raw_cmd_dict[raw_flag];
          }
        }
      }
    }
    let chiaPlotsCreateArgs = "chia-plotter plots create";
    for (let flag in raw_cmd_dict) {
      chiaPlotsCreateArgs += ` -${flag}${
        raw_cmd_dict[flag] != null ? " " + raw_cmd_dict[flag] : ""
      }`;
    }
    let jobId = `${process.hrtime.bigint().toString()}-${this.#logIdx++}`;
    let jobPath = chiaPath.getChiaStoragePath("chiaplotter/job", jobId);
    let logPath = path.join(jobPath, `plot.log`);
    let errorPath = path.join(jobPath, `plot.error.log`);
    chiaPath.makeSureDirSync(jobPath);
    chiaPath.makeSureExeFileDuplicated(this.#option.cwd);

    let out;

    let subProc = cp.exec(
      chiaPlotsCreateArgs + " >> " + logPath + " 2>> " + errorPath,

      {
        stdio: "ignore",
        detached: true,
        cwd: this.#option.cwd,
      },
      (err) => {
        console.error("plot job", err);
        let result = {
          ...out,
          endTime: Date.now(),
          error: err != null ? err.toString() : null,
        };
        fs.writeFileSync(
          path.join(jobPath, "job.json"),
          JSON.stringify(result, 4, 4)
        );
        this.emit("plot_exit", err, result);
      }
    );
    subProc.unref()
    out = {
      args,
      command: chiaPlotsCreateArgs,
      pid  : subProc.pid,
      startTime: Date.now(),
      log: logPath,
      error: errorPath,
      jobId,
    };
    fs.writeFileSync(path.join(jobPath, "job.json"), JSON.stringify(out, 4, 4));
    return out;
  }

  /**
   *
   * @param { Number } k_size Plot size  [default: 32]
   * @param { Number } b_buffer Megabytes for sort/plot buffer  [default:4608]
   * @param { Number } r_num_threads Number of threads to use  [default: 2]
   * @param { Number} u_buckets Number of buckets  [default: 128]
   * @param { Path } t_tmp_dir Temporary directory for plotting files [default: .]
   * @param { Path } d_final_dir Final directory for plots (relative or absolute)  [default: .]
   * @param { Boolean } e_nobitfield Disable bitfield
   * @param { Number } n_num  Number of plots or challenges  [default: 1]
   * @param { Boolean } x_exclude_final_dir Skips adding [final dir] to harvester for farming
   * @param { Path } $2_tmp2_dir Second temporary directory for plotting files
   * @param { String } a_alt_fingerprint  Enter the alternative fingerprint of the key you want to use
   * @param { String } c_pool_contract_address TEXT Address of where the pool reward will be sent to. Only used if alt_fingerprint and pool public key are None
   * @param { String } f_farmer_public_key Hex farmer public key
   * @param { String } p_pool_public_key Hex public key of pool
   * @param { String } i_plotid PlotID in hex for reproducing plots (debugging only)
   * @param { String } m_memo Memo in hex for reproducing plots (debugging only)
   * @returns
   */
  createPlotEx(
    k_size,
    b_buffer,
    r_num_threads,
    u_buckets,
    t_tmp_dir,
    d_final_dir,
    e_nobitfield,
    n_num,
    x_exclude_final_dir,
    $2_tmp2_dir,
    a_alt_fingerprint,
    c_pool_contract_address,
    f_farmer_public_key,
    p_pool_public_key,
    i_plotid,
    m_memo
  ) {
    return this._createPlot({
      k_size,
      b_buffer,
      r_num_threads,
      u_buckets,
      t_tmp_dir,
      d_final_dir,
      e_nobitfield,
      n_num,
      x_exclude_final_dir,
      $2_tmp2_dir,
      a_alt_fingerprint,
      c_pool_contract_address,
      f_farmer_public_key,
      p_pool_public_key,
      i_plotid,
      m_memo,
    });
  }
}


// async function main(){


//   await new Promise(r=>setTimeout(r,3600)) //3*3600*1e3
//   let to = new cliRPC();
//   // console.log(to.chiaVerion);
//   // console.log(to.plotPaths());
//   // console.log(to.walletRecvAddress);
//   for(let i=0;i<4;i++)
//   console.log(
//     to.createPlotEx(
//       32, //k
//       3390, //mem
//       4,
//       128, //bucket
//       "d:\\ssdfolder", //tempfile
//       "H:\\nasfolder", // storage file
//       true,
//       3,
//       true,
//       null
//     )
//   );
//   await new Promise(r=>setTimeout(r,5000))
// }
// main()
