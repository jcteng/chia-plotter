const psList = require('ps-list');

var express = require('express');
var router = express.Router();

const { snapshot } = require("process-list");

const _ = require("lodash")
/* GET home page. */
router.get('/list', async function(req, res, next) {


    const rsnapshot = await snapshot('pid', 'name',"path","pmem","cpu","cmdline");

    let out = _.filter(rsnapshot,v=>v.name.toLowerCase().includes("chia")||v.path.toLowerCase().includes("chia"))
    res.end(JSON.stringify(out,4,4))
});


module.exports = router;
