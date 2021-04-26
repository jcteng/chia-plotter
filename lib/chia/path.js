const fs = require("fs");
const path = require("path");
const os = require("os");
function getChiaStoragePath(...args) {
  let chiaHome = path.join(os.homedir(), ".chia", ...args);
  return chiaHome;
}

function checkExisted(...args) {
  return fs.existsSync(getChiaStoragePath(...args));
}

const KnownExeHome = ["AppData/Local/chia-blockchain", "AppData/Local/chia"];
const DaemonLocateInVerPackage = `resources/app.asar.unpacked/daemon`;

function findChiaInstLocates(baseLocal) {
  let confirmedDir = [];
  let chiaExeHome = path.join(os.homedir(), baseLocal);
  if (!fs.existsSync(chiaExeHome)) {
    return confirmedDir;
  }
  let exeVerFolders = fs.readdirSync(chiaExeHome);
  exeVerFolders.forEach((verDir) => {
    let daemonLocate = path.join(
      chiaExeHome,
      verDir,
      `resources/app.asar.unpacked/daemon`
    );
    if (fs.existsSync(path.join(daemonLocate, "chia.exe"))) {
      confirmedDir.push({ locate: daemonLocate, ver: verDir });
    }
  });
  return confirmedDir;
}
function ExecLocations() {
  let out = [];
  KnownExeHome.forEach(
    (relatePath) => (out = out.concat(findChiaInstLocates(relatePath)))
  );
  return out;
}

function makeSureDirSync(pathToCreate) {
  pathToCreate.split(path.sep).reduce((prevPath, folder) => {
    const currentPath = path.join(prevPath, folder, path.sep);
    if (!fs.existsSync(currentPath)) {
      fs.mkdirSync(currentPath);
    }
    return currentPath;
  }, "");
}

function makeSureExeFileDuplicated(locate){
    if(fs.existsSync(path.join(locate,"chia-plotter.exe"))) return false;
    if(fs.existsSync(path.join(locate,"chia-plotter"))) return false;
    if(fs.existsSync(path.join(locate,"chia.exe"))) {
        fs.copyFileSync(path.join(locate,"chia.exe"),path.join(locate,"chia-plotter.exe"))
        return true
    }
    if(fs.existsSync(path.join(locate,"chia"))) {
        fs.copyFileSync(path.join(locate,"chia"),path.join(locate,"chia-plotter"))
        return true
    }
}
module.exports = {
  getChiaStoragePath,
  checkExisted,
  ExecLocations,
  makeSureDirSync,
  makeSureExeFileDuplicated
};
