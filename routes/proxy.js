var express = require('express');
var router = express.Router();
const chia = require("../lib/chia/httpRPC")

const fullNode = new chia.FullNodeRPC()
const farmerRPC = new chia.FarmerRPC()
const walletRPC = new chia.WalletRPC()
const harvesterRPC = new chia.HarvesterRPC()

function prettyJSON(res,o){
    return res.end(JSON.stringify(o,2,2))
}
router.get('/fullnode/:func', async function(req, res, next) {
    prettyJSON(res,(await fullNode.call(req.params.func,{...(req.query||{}),...(req.body||{})})))
});
router.post('/fullnode/:func', async function(req, res, next) {
    prettyJSON(res,(await fullNode.call(req.params.func,{...(req.query||{}),...(req.body||{})})))
});

router.get('/farmer/:func', async function(req, res, next) {
    prettyJSON(res,(await farmerRPC.call(req.params.func,{...(req.query||{}),...(req.body||{})})))
});
router.post('/farmer/:func', async function(req, res, next) {
    prettyJSON(res,(await farmerRPC.call(req.params.func,{...(req.query||{}),...(req.body||{})})))
});

router.get('/wallet/:func', async function(req, res, next) {
    prettyJSON(res,(await walletRPC.call(req.params.func,{...(req.query||{}),...(req.body||{})})))
});
router.post('/wallet/:func', async function(req, res, next) {
    prettyJSON(res,(await walletRPC.call(req.params.func,{...(req.query||{}),...(req.body||{})})))
});

router.get('/harvester/:func', async function(req, res, next) {
    prettyJSON(res,(await harvesterRPC.call(req.params.func,{...(req.query||{}),...(req.body||{})})))
});
router.get('/harvester/:func', async function(req, res, next) {
    res.post((await harvesterRPC.call(req.params.func,{...(req.query||{}),...(req.body||{})})))
});

module.exports = router;
