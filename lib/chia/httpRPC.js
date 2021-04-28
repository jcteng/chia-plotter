const axios = require("axios");
const https = require("https");
const fs = require("fs");
const net = require("net");
const chiaPath = require("./path.js");

class RPCClient {
  constructor(url, cert, key) {
    console.table({ url, cert, key });
    this.baseURL = url;
    this.axios = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        cert: fs.readFileSync(cert),
        key: fs.readFileSync(key),
      }),
    });
  }
  async get_connections() {
    return this.call("/get_connections");
  }
  /*  FULL_NODE = 1
        HARVESTER = 2
        FARMER = 3
        TIMELORD = 4
        INTRODUCER = 5
        WALLET = 6
    */
  open_connection(host, port) {
    return this.call("/open_connection", { host, port });
  }

  close_connection(node_id) {
    return this.call("/close_connection", { node_id });
  }
  async call(remoteFn, arg, method = "post") {
    try {
      return (
        await this.axios({
          method: "post",
          url: remoteFn,
          baseURL: this.baseURL,
          data: arg || {},
        })
      ).data;
    } catch (e) {
      return { success: false, message: e.message };
    }
  }
}

class FullNodeRPC extends RPCClient {
  constructor(url, cert, key) {
    super(
      url || "https://localhost:8555",
      cert ||
        chiaPath.getChiaStoragePath(
          "mainnet/config/ssl/full_node/private_full_node.crt"
        ),
      key ||
        chiaPath.getChiaStoragePath(
          "mainnet/config/ssl/full_node/private_full_node.key"
        )
    );
  }

  get_blockchain_state() {
    return this.call("/get_blockchain_state");
  }

  get_block(header_hash) {
    return this.call("/get_block", { header_hash });
  }

  get_blocks(start_height, end_height, exclude_header_hash) {
    return this.call("/get_blocks", {
      start: start_height,
      end: end_height,
      exclude_header_hash,
    });
  }
  get_block_record_by_height(height) {
    return this.call("/get_block_record_by_height", { height });
  }

  get_block_record(header_hash) {
    return this.call("/get_block_record", { header_hash });
  }

  get_block_records(start, end) {
    return this.call("/get_block_records", { start, end });
  }

  get_unfinished_block_headers() {
    return this.call("/get_unfinished_block_headers");
  }

  get_network_space(older_block_header_hash, newer_block_header_hash) {
    return this.call("/get_network_space", {
      older_block_header_hash,
      newer_block_header_hash,
    });
  }

  get_additions_and_removals(header_hash, newer_block_header_hash) {
    return this.call("/get_additions_and_removals", {
      header_hash,
      newer_block_header_hash,
    });
  }

  get_initial_freeze_period() {
    return this.call("/get_initial_freeze_period");
  }

  get_network_info() {
    return this.call("/get_network_info");
  }

  get_coin_records_by_puzzle_hash(
    puzzle_hash,
    start_height,
    end_height,
    include_spend_coins
  ) {
    return this.call("/get_coin_records_by_puzzle_hash", {
      puzzle_hash,
      start_height,
      end_height,
      include_spend_coins,
    });
  }

  get_coin_record_by_name(name) {
    return this.call("/get_coin_record_by_name", { name });
  }

  push_tx(spend_bundle) {
    return this.call("/push_tx", { spend_bundle });
  }

  get_all_mempool_tx_ids() {
    return this.call("/get_all_mempool_tx_ids");
  }

  get_all_mempool_items() {
    return this.call("/get_all_mempool_items");
  }

  get_mempool_item_by_tx_id(tx_id) {
    return this.call("/get_all_mempool_items", { tx_id });
  }
}

class WalletRPC extends RPCClient {
  constructor(url, cert, key) {
    super(
      url || "https://localhost:9256",
      cert ||
        chiaPath.getChiaStoragePath(
          "mainnet/config/ssl/wallet/private_wallet.crt"
        ),
      key ||
        chiaPath.getChiaStoragePath(
          "mainnet/config/ssl/wallet/private_wallet.key"
        )
    );
  }
  //Sets a key to active.
  log_in(fingerprint, todo) {
    return this.call("/log_in", { fingerprint });
  }
  //Get all root public keys accessible by the wallet.
  get_public_keys() {
    return this.call("/get_public_keys", {});
  }
  //Get all root private keys accessible by the wallet.
  get_private_key(fingerprint) {
    return this.call("/get_private_key", {fingerprint});
  }
  //Generate a 24 word mnemonic phrase, used to derive a private key.
  generate_mnemonic() {
    return this.call("/generate_mnemonic", {});
  }
  //Add a private key to the keychain
  add_key(key, todo) {
    return this.call("/add_key", { key });
  }
  //Delete a private key from the keychain
  delete_key(key, todo) {
    return this.call("/delete_key", { key });
  }
  //Delete all private keys from the keychain
  delete_all_keys() {
    return this.call("/delete_all_keys", {});
  }
  //Gets the sync status of the wallet.
  get_sync_status() {
    return this.call("/get_sync_status", {});
  }
  //Gets information about the current height of the wallet.
  get_height_info() {
    return this.call("/get_height_info", {});
  }
  //Farms a block, only available with the simulator.
  farm_block(blockid, todo) {
    return this.call("/farm_block", { blockid });
  }
  //Retrieves the initial freeze period for the blockchain (no transactions allowed).
  get_initial_freeze_period() {
    return this.call("/get_initial_freeze_period", {});
  }
  //Retrieves some information about the current network.
  get_network_info() {
    return this.call("/get_network_info", {});
  }
  //Gets a list of wallets for this key.
  get_wallets() {
    return this.call("/get_wallets", {});
  }
  //Creates a new wallet for this key.
  create_new_wallet() {
    return this.call("/create_new_wallet", {});
  }
  //Retrieves balances for a wallet
  get_wallet_balance(wallet_id) {
    return this.call("/get_wallet_balance", {});
  }
  //Gets a transaction record by transaction id
  get_transaction(transaction_id) {
    return this.call("/get_transaction", {transaction_id});
  }
  //Gets transaction records
  get_transactions() {
    return this.call("/get_transactions", {});
  }
  //Gets a new (or not new) address
  get_next_address(new_address) {
    return this.call("/get_next_address", {new_address});
  }
  //Sends a standard transaction to a target puzzle_hash.
  send_transaction() {
    return this.call("/send_transaction", {});
  }
  //Creates a backup for this wallet.
  create_backup(file_path) {
    return this.call("/create_backup", {file_path});
  }
  //Gets the number of transactions in this wallet.
  get_transaction_count(wallet_id) {
    return this.call("/get_transaction_count", {wallet_id});
  }
  //Gets information about farming rewards for this wallet.
  get_farmed_amount() {
    return this.call("/get_farmed_amount", {});
  }
}
class HarvesterRPC extends RPCClient {
  constructor(url, cert, key) {
    super(
      url || "https://localhost:8560",
      cert ||
        chiaPath.getChiaStoragePath(
          "mainnet/config/ssl/harvester/private_harvester.crt"
        ),
      key ||
        chiaPath.getChiaStoragePath(
          "mainnet/config/ssl/harvester/private_harvester.key"
        )
    );
  }
  //gets a list of plots being farmed on this harvester.
  get_plots() {
    return this.call("/get_plots", {});
  }
  //Refreshes the plots, forces the harvester to search for and load new plots.
  refresh_plots() {
    return this.call("/refresh_plots", {});
  }
  //Deletes a plot file and removes it from the harvester.
  delete_plot(filename) {
    return this.call("/delete_plot", {filename});
  }
  //Adds a plot directory (not including sub-directories) to the harvester and configuration. Plots will be loaded and farmed eventually.
  add_plot_directory(dirname) {
    return this.call("/add_plot_directory", {dirname});
  }
  //Returns all of the plot directoried being farmed.
  get_plot_directories() {
    return this.call("/get_plot_directories", {});
  }
  //Removes a plot directory from the config, does not actually delete the directory.
  remove_plot_directory(dirname) {
    return this.call("/remove_plot_directory", {dirname});
  }
}
class FarmerRPC extends RPCClient {
  constructor(url, cert, key) {
    super(
      url || "https://localhost:8559",
      cert ||
        chiaPath.getChiaStoragePath(
          "mainnet/config/ssl/farmer/private_farmer.crt"
        ),
      key ||
        chiaPath.getChiaStoragePath(
          "mainnet/config/ssl/farmer/private_farmer.key"
        )
    );
  }
  /**
   * Gets a signage point by signage point hash, as well as any winning proofs.
   * @param {*} sp_hash: the hash of the challenge chain signage point
   * @returns {"signage_point": {...}, "proofs": [...]}
   */
  get_signage_point(sp_hash) {
    return this.call("/get_signage_point", {sp_hash});
  }
  /**
   * Gets a list of recent signage points as well as winning proofs.
   * @returns {"signage_points": [...]}
   */
  get_signage_points() {
    return this.call("/get_signage_points", {});
  }
  /**
   * search_for_private_key: whether to check if we own the private key for these addreses. Can take a long time{, and not guaranteed to return True.
   * @param {*} search_for_private_key  whether to check if we own the private key for these addreses. Can take a long time{, and not guaranteed to return True.
   * @returns
   */
  get_reward_targets(search_for_private_key) {
    return this.call("/get_reward_targets", {search_for_private_key});
  }
  /**
   * Sets the reward targets in the farmer and configuration file.
   * @param {*} farmer_target farmer target address
   * @param {*} pool_target  pool target address
   * @returns
   */
  set_reward_targets(farmer_target,pool_target) {
    return this.call("/set_reward_targets", {farmer_target,pool_target});
  }
}

module.exports = { FullNodeRPC, FarmerRPC, HarvesterRPC, WalletRPC };
