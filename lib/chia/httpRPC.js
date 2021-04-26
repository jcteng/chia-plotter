
const axios = require("axios")
const https = require("https")
const fs = require("fs")
const net = require("net")
const chiaPath = require("./path.js")

class RPCClient {
    constructor(url, cert, key) {
        console.table({ url, cert, key })
        this.baseURL = url
        this.axios = axios.create({
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
                cert: fs.readFileSync(cert),
                key: fs.readFileSync(key),
            })
        });
    }
    async get_connections() {
        return this.call("/get_connections")
    }
    /*  FULL_NODE = 1
        HARVESTER = 2
        FARMER = 3
        TIMELORD = 4
        INTRODUCER = 5
        WALLET = 6
    */
    open_connection(host, port) {
        return this.call("/open_connection",{host, port})
    }


    close_connection(node_id) {
        return this.call("/close_connection",{node_id})

    }
    async call(remoteFn, arg, method = "post") {
        try {
            return (await this.axios({
                method: "post",
                url: remoteFn,
                baseURL: this.baseURL,
                data: arg || {}
            })).data
        } catch (e) {
            return { "success": false, message: e.message }
        }


    }
}


class FullNodeRPC extends RPCClient {

    constructor(url, cert, key) {

        super(
            url || "https://localhost:8555",
            cert || chiaPath.getChiaStoragePath("mainnet/config/ssl/full_node/private_full_node.crt"),
            key || chiaPath.getChiaStoragePath("mainnet/config/ssl/full_node/private_full_node.key")
        )

    }

    get_blockchain_state() {
        return this.call("/get_blockchain_state")
    }

    get_block(header_hash) {
        return this.call("/get_block", { header_hash })
    }

    get_blocks(start_height, end_height, exclude_header_hash) {
        return this.call("/get_blocks",
            { start: start_height, end: end_height, exclude_header_hash })
    }
    get_block_record_by_height(height) {
        return this.call("/get_block_record_by_height", { height })
    }

    get_block_record(header_hash) {
        return this.call("/get_block_record", { header_hash })
    }

    get_block_records(start, end) {
        return this.call("/get_block_records", {  start, end })
    }

    get_unfinished_block_headers() {
        return this.call("/get_unfinished_block_headers")
    }

    get_network_space(older_block_header_hash, newer_block_header_hash) {
        return this.call("/get_network_space",{ older_block_header_hash, newer_block_header_hash})
    }

    get_additions_and_removals(header_hash, newer_block_header_hash) {
        return this.call("/get_additions_and_removals",{ header_hash, newer_block_header_hash})
    }

    get_initial_freeze_period() {
        return this.call("/get_initial_freeze_period")
    }

    get_network_info() {
        return this.call("/get_network_info")
    }

    get_coin_records_by_puzzle_hash(puzzle_hash, start_height, end_height, include_spend_coins) {
        return this.call("/get_coin_records_by_puzzle_hash",{ puzzle_hash, start_height, end_height, include_spend_coins })
    }

    get_coin_record_by_name(name) {
        return this.call("/get_coin_record_by_name",{ name })
    }

    push_tx(spend_bundle) {
        return this.call("/push_tx",{ spend_bundle })
    }

    get_all_mempool_tx_ids() {
        return this.call("/get_all_mempool_tx_ids")
    }

    get_all_mempool_items() {
        return this.call("/get_all_mempool_items")
    }

    get_mempool_item_by_tx_id(tx_id) {
        return this.call("/get_all_mempool_items",{ tx_id })
    }
}



module.exports = {FullNodeRPC}