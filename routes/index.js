var express = require('express');
var router = express.Router();
const {FullNodeRPC} = require("../lib/chia/httpRPC")

const fullNode = new FullNodeRPC()
/* GET home page. */
router.get('', async function(req, res, next) {
    res.json((await fullNode.call(req.query.func,req.body)))
});


module.exports = router;
